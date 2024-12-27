// src/components/LobbyPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function LobbyPage() {
    const [parties, setParties] = useState([]);
    const [playerId, setPlayerId] = useState(localStorage.getItem('playerId') || '');
    const [loggedIn, setLoggedIn] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (playerId && localStorage.getItem('playerId')) {
            setLoggedIn(true);
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

        // if (loggedIn) {
        //     const interval = setInterval(fetchParties, 5000);
        //     return () => clearInterval(interval);
        // }
    }, [loggedIn]);

    const handleJoinParty = async (partyId) => {
        console.log('joining party', partyId);
        try {
            const response = await axios.post(`/api/party/${partyId}/join`, {
                user_id: playerId
            });
            navigate(`/questions?party_id=${partyId}`);
        } catch (error) {
            alert('Error joining party: ' + error.message);
        }
    };

    const handleLogin = (e) => {
        e.preventDefault();
        if (playerId) {
            localStorage.setItem('playerId', playerId);
            setLoggedIn(true);
        }
    };

    return (
        <main>
            <section className="container">
                {!loggedIn ? (
                    <form onSubmit={handleLogin}>
                        <label>
                            Player ID:
                            <input
                                type="text"
                                value={playerId}
                                onChange={(e) => setPlayerId(e.target.value)}
                                required
                            />
                        </label>
                        <br /><br />
                        <button type="submit" disabled={!playerId}>Login</button>
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
                                        <strong>Participants:</strong> {party.participants.join(', ')} <br />
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