import { sql } from '@vercel/postgres';
import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests are allowed.' });
  }

  const buf = await buffer(req);
  const rawBody = buf.toString('utf8');
  
  // ### THIS IS THE FIX ###
  // We are now looking for the correct header name: 'x-whop-signature'
  const signature = req.headers['x-whop-signature'];
  const webhookSecret = process.env.WHOP_WEBHOOK_SECRET;

  try {
    if (!signature || !webhookSecret) {
      throw new Error('Missing signature or webhook secret.');
    }

    const sigParts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {});
    
    const timestamp = sigParts.t;
    const whopSignature = sigParts.v1;

    if (!timestamp || !whopSignature) {
      throw new Error('Invalid signature format.');
    }

    const signedPayload = `${timestamp}.${rawBody}`;
    
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');
    
    const isVerified = crypto.timingSafeEqual(Buffer.from(whopSignature), Buffer.from(expectedSignature));

    if (!isVerified) {
      throw new Error('Webhook signature verification failed.');
    }

    const data = JSON.parse(rawBody);

    if (data.type === 'payment.succeeded') {
      console.log('✅ Payment succeeded event received and verified!');
      
      const { whop_user_id, username } = data.data.user;
      const tournamentId = 1;

      await sql`
        INSERT INTO Users (whop_user_id, whop_username)
        VALUES (${whop_user_id}, ${username})
        ON CONFLICT (whop_user_id) DO UPDATE SET whop_username = ${username};
      `;

      const { rows: users } = await sql`SELECT id FROM Users WHERE whop_user_id = ${whop_user_id};`;
      const internalUserId = users[0].id;
      
      await sql`
        INSERT INTO GameEntries (user_id, tournament_id, best_score)
        VALUES (${internalUserId}, ${tournamentId}, 0)
        ON CONFLICT (user_id, tournament_id) DO NOTHING;
      `;

      console.log(`Granted tournament access to user: ${username}`);
    }

    res.status(200).send('Webhook received and verified.');
  } catch (error) {
    console.error('Webhook Error:', error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
}