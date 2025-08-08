// In pages/tournament/demo-payment.js
import { useEffect } from 'react';

export default function DemoPaymentPage() {

  const handleConfirmPayment = () => {
    // 1. Check if there's an "opener" window (the main game page)
    if (window.opener) {
      // 2. Change the URL of the main page to include the success flag
      window.opener.location.href = '/?status=success';
    }
    
    // 3. Close this popup window
    window.close();
  };

  // Basic styling for the page
  useEffect(() => {
    document.body.style.fontFamily = 'sans-serif';
    document.body.style.textAlign = 'center';
    document.body.style.padding = '50px';
    document.body.style.background = '#f0f0f0';
  }, []);

  return (
    <div>
      <h1>Tournament Entry</h1>
      <p>This is a demo payment screen.</p>
      <p>Confirming your entry for <strong>$2.00</strong>.</p>
      <button 
        onClick={handleConfirmPayment}
        style={{ padding: '15px 30px', fontSize: '18px', cursor: 'pointer', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px' }}
      >
        Confirm and Return to Game
      </button>
    </div>
  );
}