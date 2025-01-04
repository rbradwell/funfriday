// src/components/LobbyPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function LobbyPage() {
    const [parties, setParties] = useState([]);
    const [playerId, setPlayerId] = useState(localStorage.getItem('playerId') || null);
    const navigate = useNavigate();
    const playerNameRef = useRef(null);

    useEffect(() => {
        if (playerId) {
            console.log('playerId', playerId);
            console.log('logged in');
        }
    }, [playerId]);

    useEffect(() => {
        const fetchParties = async () => {
            try {
                const response = await axios.get('/api/parties');
                setParties(response.data.parties);
                console.log('parties', response.data.parties);
            } catch (error) {
                console.error('Error fetching parties:', error);
            }
        };

        fetchParties();

        if (playerId) {
            const interval = setInterval(fetchParties, 5000);
            return () => clearInterval(interval);
        }
    }, [playerId]);

    const handleJoinParty = async (partyId) => {
        console.log('joining party', partyId);
        console.log('playerId', playerId);
        try {
            const response = await axios.post(`/api/party/${partyId}/join`, {
                user_id: playerId
            });
            navigate(`/quiz?party_id=${partyId}&user_id=${playerId}`);
        } catch (error) {
            alert('Error joining party: ' + error.message);
        }
    };

    const handleLogin = async(e) => {
        e.preventDefault();
        const playerName = playerNameRef.current.value;
        if (playerName) {
            try {
                const response = await axios.post(`/api/user/create`, {
                    user_name: playerName
                });
                localStorage.setItem('playerId', response.data.user_id);
                setPlayerId(response.data.user_id);
            } catch (error) {
                alert('Error registering player: ' + error.message);
            }    
        }
    };

    return (
        <main>
            <section className="container">
                {!playerId ? (
                    <form onSubmit={handleLogin}>
                        <label>
                            Player ID:
                            <input
                                type="text"
                                ref={playerNameRef}
                                required
                            />
                        </label>
                        <br /><br />
                        <button type="submit">Login</button>
                    </form>
                ) : (
                    parties.length === 0 ? (
                        <>
                            <h3>No games have been created yet...</h3>
                            <button onClick={() => navigate('/create')}>Create a Game</button>
                        </>
                    ) : (
                        <ul>
                            {parties.map((party) => (
                                <li key={party.party_id}>
                                    <div>
                                        <strong>ID:</strong> {party.party_id} <br />
                                        <strong>Creator:</strong> {party.creator} <br />
                                        <strong>Rounds:</strong> {party.rounds} <br />
                                        <strong>Participants:</strong> {party.participants} <br />
                                        <button onClick={() => handleJoinParty(party.party_id)}>Join Game</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )
                )}
            </section>
        </main>
    );
}

export default LobbyPage;