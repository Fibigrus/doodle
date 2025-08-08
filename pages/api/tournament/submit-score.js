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

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { score } = req.body;
    
    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({ error: 'Invalid score' });
    }

    const userId = req.headers['x-user-id'] || 'demo-user';
    
    const userEntry = tournamentData.currentTournament.entries.find(
      entry => entry.userId === userId
    );

    if (!userEntry) {
      return res.status(403).json({ error: 'Must join tournament first' });
    }

    if (score > userEntry.bestScore) {
      userEntry.bestScore = score;
      console.log(`User ${userEntry.userName} new best score: ${score}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Submit score error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}