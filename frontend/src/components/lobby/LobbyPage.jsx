// src/components/LobbyPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import UserLogin from './UserLogin';
import GamePartyList from './GamePartyList';

function LobbyPage() {
    const [parties, setParties] = useState([]);
    const [playerId, setPlayerId] = useState(localStorage.getItem('playerId') || null);
    const navigate = useNavigate();

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

    const handleLogin = async (playerName) => {
        try {
            const response = await axios.post(`/api/user/create`, {
                user_name: playerName
            });
            localStorage.setItem('playerId', response.data.user_id);
            setPlayerId(response.data.user_id);
        } catch (error) {
            alert('Error registering player: ' + error.message);
        }
    };

    return (
        <main>
            <section className="container">
                {!playerId ? (
                    <UserLogin onLogin={handleLogin} />
                ) : (
                    <GamePartyList parties={parties} />
                )}
            </section>
        </main>
    );
}

export default LobbyPage;