export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests are allowed.' });
  }

  try {
    const response = await fetch('https://data.whop.com/api/v2/checkout_links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WHOP_PRIVATE_API_KEY}`,
      },
      body: JSON.stringify({
        product: 'prod_Oy22HTl5o2vC5', // PASTE YOUR PRODUCT ID HERE
        // You can add metadata if needed, for example:
        // metadata: {
        //   note: 'Doodle Jump Tournament Entry'
        // }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      // Log the detailed error from Whop for debugging
      console.error('Whop API Error:', errorData); 
      throw new Error(errorData.message || 'Failed to create checkout link.');
    }

    const data = await response.json();
    
    // Send the checkout URL back to the frontend
    res.status(200).json({ checkoutUrl: data.url });

  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({ message: error.message });
  }
}