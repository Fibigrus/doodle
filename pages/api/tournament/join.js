export default async function handler(req, res) {
  // Set proper headers
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const baseUrl = 'https://doodlejump-rcohp1ppk-davids-projects-584ef7ef.vercel.app';
    const paymentUrl = `${baseUrl}/api/tournament/demo-payment?userId=demo-user`;

    return res.status(200).json({
      success: true,
      paymentUrl: paymentUrl
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}