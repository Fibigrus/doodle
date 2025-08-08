import crypto from 'crypto';

// In-memory storage for tournament data (replace with database in production)
let tournamentData = {
  currentTournament: {
    id: `tournament_${new Date().toISOString().split('T')[0]}`,
    startTime: new Date().setHours(0, 0, 0, 0),
    endTime: new Date().setHours(23, 59, 59, 999),
    entries: [],
    prizePool: 0
  },
  leaderboard: []
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify webhook signature
    const signature = req.headers['x-whop-signature'];
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', process.env.WHOP_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    if (`sha256=${expectedSignature}` !== signature) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { type, data } = req.body;

    if (type === 'payment_succeeded') {
      const { id: paymentId, amount, metadata, user } = data;

      // Add user to tournament
      const userId = user?.id || metadata?.userId || paymentId;
      const userName = user?.username || user?.email || `Player ${userId.slice(0, 6)}`;

      // Check if user already entered today's tournament
      const existingEntry = tournamentData.currentTournament.entries.find(
        entry => entry.userId === userId
      );

      if (!existingEntry) {
        tournamentData.currentTournament.entries.push({
          userId,
          userName,
          paymentId,
          entryTime: new Date().toISOString(),
          bestScore: 0
        });

        // Update prize pool ($2.00 = 200 cents)
        tournamentData.currentTournament.prizePool += 2.00;

        console.log(`User ${userName} joined tournament. Prize pool: $${tournamentData.currentTournament.prizePool}`);
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}