import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { sql } from '@vercel/postgres';

async function validateWhopJwt(jwt) {
  const JWKS = createRemoteJWKSet(new URL('https://data.whop.com/api/v2/oauth/jwks'));
  const { payload } = await jwtVerify(jwt, JWKS, {
    issuer: 'urn:whop.com:exp-proxy',
  });
  if (!payload.has_access) {
    throw new Error('You do not have access to this app.');
  }
  return payload;
}

export default function TournamentDoodleJump({ user, initialLeaderboard, error }) {
    const canvasRef = useRef(null);
    const router = useRouter();

    const [score, setScore] = useState(0);
    const scoreRef = useRef(score);
    const [timeRemaining, setTimeRemaining] = useState('');
    const [gameStarted, setGameStarted] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [showGameOverScreen, setShowGameOverScreen] = useState(false);
    const [tournamentData, setTournamentData] = useState({
        prizePool: 0,
        playerCount: initialLeaderboard.length,
        userBestScore: 0,
        hasEntered: false,
    });
    
    const [leaderboard, setLeaderboard] = useState(initialLeaderboard);

    const gameRef = useRef({
        player: { x: 191, y: 400, vx: 0, vy: 0, width: 40, height: 40 },
        platforms: [],
        enemies: [],
        keys: { left: false, right: false },
        gameRunning: false,
    });
    
    const fetchLeaderboard = async () => {
        try {
            const response = await fetch('/api/leaderboard');
            if (!response.ok) throw new Error('Failed to fetch');
            const data = await response.json();
            setLeaderboard(data);
            setTournamentData(prev => ({...prev, playerCount: data.length}));
        } catch (error) {
            console.error("Failed to fetch leaderboard:", error);
        }
    };
    
    const getTimeRemaining = () => {
        const now = new Date();
        const endTime = new Date(now);
        endTime.setHours(23, 59, 59, 999);
        const diff = endTime - now;
        if (diff <= 0) return "00:00:00";
        const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    };
    
    useEffect(() => {
        const timerInterval = setInterval(() => {
            setTimeRemaining(getTimeRemaining());
        }, 1000);
        return () => clearInterval(timerInterval);
    }, []);
    
    const handleJoinTournament = () => {
        const staticCheckoutUrl = 'https://whop.com/checkout/plan_v7cxYiUA3uNIX?d2c=true';
        window.location.href = staticCheckoutUrl;
    };

    const submitScore = async (finalScore) => {
        const whop_jwt = router.query.whop_jwt || router.query['whop-dev-user-token'];
        if (!whop_jwt) {
            console.error("Not logged in via Whop, can't submit score.");
            setTournamentData(prev => ({...prev, userBestScore: Math.max(prev.userBestScore, finalScore)}));
            return;
        }

        try {
            const response = await fetch('/api/scores/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${whop_jwt}`,
                },
                body: JSON.stringify({ score: finalScore }),
            });

            if (!response.ok) throw new Error('Score submission failed');

            await fetchLeaderboard();
            setTournamentData(prev => ({...prev, userBestScore: Math.max(prev.userBestScore, finalScore)}));
        } catch (error) {
            console.error("Failed to submit score:", error);
        }
    };
    
    const handlePlayAgain = () => {
        setGameOver(false);
        setShowGameOverScreen(false);
        setGameStarted(false);
        setTimeout(() => setGameStarted(true), 10);
    };

    // Main Game Logic Effect
    useEffect(() => {
        if (!gameStarted || gameOver) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const gameState = gameRef.current;
        let totalScrolledHeight = 0;

        canvas.width = 422;
        canvas.height = 552;
        const initPlatforms = () => {
            const platforms = [];
            for (let i = 0; i < 10; i++) {
                platforms.push({ x: Math.random() * (canvas.width - 80), y: canvas.height - 50 - (i * 55), width: 80, height: 15, type: Math.random() > 0.8 ? 2 : 1, vx: Math.random() > 0.5 ? 1 : -1 });
            }
            platforms[0] = { x: 171, y: canvas.height - 50, width: 80, height: 15, type: 1, vx: 0 };
            return platforms;
        };
        gameState.platforms = initPlatforms();
        gameState.player = { x: 191, y: 400, vx: 0, vy: 0, width: 40, height: 40 };
        gameState.gameRunning = false;
        gameState.keys = { left: false, right: false };
        setScore(0);
        scoreRef.current = 0;

        const drawPlayer = (player) => {
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(player.x + 10, player.y + 15, 20, 20);
            ctx.beginPath();
            ctx.arc(player.x + 20, player.y + 10, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.fillRect(player.x + 15, player.y + 7, 3, 3);
            ctx.fillRect(player.x + 22, player.y + 7, 3, 3);
            ctx.fillRect(player.x + 12, player.y + 35, 6, 5);
            ctx.fillRect(player.x + 22, player.y + 35, 6, 5);
        };

        const drawPlatform = (platform) => {
            ctx.fillStyle = platform.type === 1 ? '#228B22' : '#4169E1';
            ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        };
        
        const checkCollisions = () => {
          const player = gameState.player;
          const feetHitboxWidth = player.width * 0.75;
          const feetHitboxLeft = player.x + (player.width - feetHitboxWidth) / 2;
          const feetHitboxRight = feetHitboxLeft + feetHitboxWidth;

          gameState.platforms.forEach(platform => {
            if (
              player.vy > 0 &&
              feetHitboxRight > platform.x &&
              feetHitboxLeft < platform.x + platform.width &&
              player.y + player.height > platform.y &&
              player.y + player.height < platform.y + platform.height + 10
            ) {
              player.vy = -8.4;
            }
          });
        };

        let animationFrameId;
        const gameLoop = () => {
            if (!gameRef.current || gameOver) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (!gameState.gameRunning) {
                gameState.platforms.forEach(drawPlatform);
                drawPlayer(gameState.player);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(50, 200, canvas.width - 100, 100);
                ctx.fillStyle = '#FFD700';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Press SPACE to start!', canvas.width / 2, 240);
                ctx.fillText('Use ← → to move', canvas.width / 2, 270);
            } else {
                const player = gameState.player;
                if (gameState.keys.left) player.vx -= 0.15; else if (player.vx < 0) player.vx += 0.1;
                if (gameState.keys.right) player.vx += 0.15; else if (player.vx > 0) player.vx -= 0.1;
                
                if (Math.abs(player.vx) < 0.1) {
                    player.vx = 0;
                }

                player.vx = Math.max(-8, Math.min(8, player.vx));
                player.x += player.vx;

                if (player.x <= 0) { player.x = 0; player.vx = Math.abs(player.vx) * 0.7; }
                else if (player.x + player.width >= canvas.width) { player.x = canvas.width - player.width; player.vx = -Math.abs(player.vx) * 0.7; }
                
                gameState.platforms.forEach(platform => {
                    if (platform.type === 2) {
                        platform.x += platform.vx;
                        if (platform.x <= 0 || platform.x + platform.width >= canvas.width) {
                            platform.vx *= -1;
                        }
                    }
                });

                player.y += player.vy;
                player.vy += 0.2;
                checkCollisions();

                if (player.y < canvas.height / 2) {
                    const scrollAmount = canvas.height / 2 - player.y;
                    
                    totalScrolledHeight += scrollAmount;
                    const newScore = Math.floor(totalScrolledHeight / 10);
                    setScore(newScore);
                    scoreRef.current = newScore;
                    
                    player.y = canvas.height / 2;
                    gameState.platforms.forEach(p => p.y += scrollAmount);
                    gameState.platforms = gameState.platforms.filter(p => p.y < canvas.height);
                    while (gameState.platforms.length < 10) {
                        const newY = Math.min(...gameState.platforms.map(p => p.y)) - 55;
                        gameState.platforms.unshift({ x: Math.random() * (canvas.width - 80), y: newY, width: 80, height: 15, type: Math.random() > 0.8 ? 2 : 1, vx: Math.random() > 0.5 ? 1 : -1 });
                    }
                }
                
                if (player.y > canvas.height) {
                    submitScore(scoreRef.current);
                    setGameOver(true);
                    setShowGameOverScreen(true);
                    cancelAnimationFrame(animationFrameId);
                    return;
                }
                
                gameState.platforms.forEach(drawPlatform);
                drawPlayer(player);
            }

            animationFrameId = requestAnimationFrame(gameLoop);
        };

        const handleKeyDown = (e) => {
            if (e.code === 'Space' && !gameState.gameRunning && !gameOver) {
                e.preventDefault();
                gameState.gameRunning = true;
                gameState.player.vy = -8.4;
            }
            if (e.code === 'ArrowLeft') gameState.keys.left = true;
            if (e.code === 'ArrowRight') gameState.keys.right = true;
        };
        const handleKeyUp = (e) => {
            if (e.code === 'ArrowLeft') gameState.keys.left = false;
            if (e.code === 'ArrowRight') gameState.keys.right = false;
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        gameLoop();

        return () => {
            cancelAnimationFrame(animationFrameId);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, [gameStarted, gameOver]);

    if (error) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: 'white', textAlign: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <div>
                    <h1>Access Denied</h1>
                    <p>{error}</p>
                    <p>Please make sure you have access to this app through Whop.</p>
                </div>
            </div>
        );
    }
    
    return (
        <>
            <Head><title>🏆 Doodle Jump Royale</title></Head>
            <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px', fontFamily: 'sans-serif' }}>
                <div style={{ textAlign: 'center', marginBottom: '20px', color: 'white' }}>
                    <div style={{ display: 'inline-block', background: 'rgba(0,0,0,0.7)', padding: '10px 20px', borderRadius: '15px' }}>
                        <h2 style={{ margin: 0, fontSize: '16px' }}>🏆 Doodle Jump Royale</h2>
                        <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#FFD700' }}>Time Left: {timeRemaining}</p>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                    <div style={{ border: '3px solid #333', borderRadius: '10px', position: 'relative', boxShadow: '0 0 30px rgba(0,0,0,0.5)' }}>
                        <canvas ref={canvasRef} style={{ display: 'block', background: 'linear-gradient(to bottom, #87CEEB 0%, #98FB98 50%, #90EE90 100%)' }} />
                        <div style={{ position: 'absolute', top: 0, left: 0, background: 'rgba(0, 0, 0, 0.8)', color: 'white', padding: '8px 12px', borderRadius: '8px 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>Score: {score}</div>

                        {!tournamentData.hasEntered && (
                           <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white', padding: '20px' }}>
                                <h1 style={{ fontSize: '32px', color: '#FFD700', textShadow: '2px 2px 4px #000' }}>Daily Tournament!</h1>
                                <button onClick={handleJoinTournament} style={{ background: 'linear-gradient(to bottom, #4CAF50, #45a049)', border: 'none', borderRadius: '25px', color: 'white', fontSize: '14px', padding: '12px 24px', cursor: 'pointer', boxShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>Join Tournament ($2.00)</button>
                            </div>
                        )}
                        
                        {tournamentData.hasEntered && !gameStarted && (
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white', padding: '20px' }}>
                                <h1 style={{ fontSize: '32px', color: '#44FF44', textShadow: '2px 2px 4px #000' }}>You're In!</h1>
                                <button onClick={() => setGameStarted(true)} style={{ background: 'linear-gradient(to bottom, #FF6B35, #F7931E)', border: 'none', borderRadius: '25px', color: 'white', fontSize: '14px', padding: '12px 24px', cursor: 'pointer', boxShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>Start Playing!</button>
                            </div>
                        )}

                        {showGameOverScreen && (
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white' }}>
                                <h1 style={{ fontSize: '36px', color: '#FF4444', textShadow: '2px 2px 4px #000' }}>Game Over!</h1>
                                <h2 style={{ fontSize: '18px', color: '#FFD700' }}>Score: {score}</h2>
                                <h3 style={{ fontSize: '14px', color: '#44FF44' }}>Best: {tournamentData.userBestScore}</h3>
                                <button onClick={handlePlayAgain} style={{ background: 'linear-gradient(to bottom, #4CAF50, #45a049)', border: 'none', borderRadius: '25px', color: 'white', fontSize: '14px', padding: '12px 24px', cursor: 'pointer', boxShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>Play Again</button>
                            </div>
                        )}
                    </div>
                    
                    <div style={{
                        width: '300px',
                        background: 'rgba(0, 0, 0, 0.8)',
                        borderRadius: '15px',
                        padding: '20px',
                        color: 'white',
                        fontFamily: '"Press Start 2P", monospace'
                    }}>
                        <h3 style={{ color: '#FFD700', fontSize: '16px', margin: '0 0 15px 0', textAlign: 'center' }}>🏆 LEADERBOARD</h3>
                        <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '10px', borderRadius: '8px', marginBottom: '15px', textAlign: 'center' }}>
                            <p style={{ color: '#44FF44', fontSize: '12px', margin: '0 0 5px 0', fontWeight: 'bold' }}>PRIZE POOL: ${tournamentData.prizePool.toFixed(2)}</p>
                            <p style={{ fontSize: '10px', margin: 0, color: '#AAA' }}>{tournamentData.playerCount} players entered</p>
                        </div>
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {leaderboard.length > 0 ? (
                                leaderboard.map((entry, index) => (
                                <div key={entry.id || index} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px',
                                    margin: '5px 0',
                                    background: user && entry.id === user.user_id ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '5px',
                                    border: user && entry.id === user.user_id ? '1px solid #FFD700' : 'none'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <span style={{ color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#FFF', fontSize: '12px', marginRight: '10px', fontWeight: 'bold' }}>#{index + 1}</span>
                                        <span style={{ fontSize: '10px' }}>{entry.playerName}</span>
                                    </div>
                                    <span style={{ color: '#44FF44', fontSize: '12px', fontWeight: 'bold' }}>{entry.score}</span>
                                </div>
                                ))
                            ) : (
                                <div style={{ textAlign: 'center', color: '#666', fontSize: '10px', padding: '20px' }}>Be the first to set a score!</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export async function getServerSideProps(context) {
  try {
    // Add a test to see if the server can reach the JWKS URL
    // Add a test to see if the server can reach the JWKS URLdd
    console.log('Attempting to fetch JWKS URL...');
    const jwksResponse = await fetch('https://data.whop.com/api/v2/oauth/jwks');
    console.log('JWKS fetch response status:', jwksResponse.status);
    if (!jwksResponse.ok) {
        throw new Error(`Failed to fetch JWKS: ${jwksResponse.statusText}`);
    }
    console.log('JWKS URL is reachable.');
    
    const whop_jwt = context.query.whop_jwt || context.query['whop-dev-user-token'];
    
    if (!whop_jwt) {
      throw new Error('Please log in through Whop to play.');
    }

    let payload;
    try {
      payload = await validateWhopJwt(whop_jwt);
    } catch (validationError) {
      console.error('❌ JWT Validation Failed:', validationError.message);
      throw new Error(`Token validation failed: ${validationError.message}`);
    }

    const tournamentId = 1;
    const { rows: leaderboardData } = await sql`
      SELECT
        U.whop_user_id as "id",
        U.whop_username as "playerName",
        GE.best_score as "score"
      FROM GameEntries GE
      JOIN Users U ON GE.user_id = U.id
      WHERE GE.tournament_id = ${tournamentId}
      ORDER BY GE.best_score DESC
      LIMIT 10;
    `;

    return {
      props: {
        user: payload, // The jose payload is the user object
        initialLeaderboard: leaderboardData,
        error: null,
      },
    };
  } catch (error) {
    console.error('❌ Error in getServerSideProps:', error.message);
    return { props: { user: null, initialLeaderboard: [], error: error.message } };
  }
}