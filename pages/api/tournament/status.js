// Import the same tournamentData from webhook (in production, use database)
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

function getTimeRemaining() {
  const now = new Date();
  const endTime = new Date();
  endTime.setHours(23, 59, 59, 999);
  
  const diff = endTime - now;
  
  if (diff <= 0) {
    // Tournament ended, reset for new day
    resetTournament();
    return "23:59:59";
  }
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function resetTournament() {
  const today = new Date().toISOString().split('T')[0];
  tournamentData.currentTournament = {
    id: `tournament_${today}`,
    startTime: new Date().setHours(0, 0, 0, 0),
    endTime: new Date().setHours(23, 59, 59, 999),
    entries: [],
    prizePool: 0
  };
  tournamentData.leaderboard = [];
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create leaderboard from entries with scores
    const leaderboard = tournamentData.currentTournament.entries
      .filter(entry => entry.bestScore > 0)
      .sort((a, b) => b.bestScore - a.bestScore)
      .slice(0, 10)
      .map(entry => ({
        id: entry.userId,
        playerName: entry.userName,
        score: entry.bestScore
      }));

    // Mock user data (in production, get from session/auth)
    const userId = req.headers['x-user-id'] || 'demo-user';
    const userEntry = tournamentData.currentTournament.entries.find(
      entry => entry.userId === userId
    );

    const response = {
      timeRemaining: getTimeRemaining(),
      prizePool: tournamentData.currentTournament.prizePool,
      playerCount: tournamentData.currentTournament.entries.length,
      userBestScore: userEntry?.bestScore || 0,
      hasEntered: !!userEntry,
      leaderboard
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}