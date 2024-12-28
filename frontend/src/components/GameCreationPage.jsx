
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// TODO - shouldnt be able to get to this page if already in a party, should be redirected to lobby if not logged in
function GameCreationPage() {
    const [playerId, setPlayerId] = useState(localStorage.getItem('playerId') || '');
    const [category, setCategory] = useState('');
    const [rounds, setRounds] = useState(1);
    const [timeout, setTimeout] = useState(30);
    const [categories, setCategories] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await fetch('/api/categories');
                if (!response.ok) {
                    throw new Error('Failed to fetch categories');
                }
                const data = await response.json();
                setCategories(data.categories);
            } catch (error) {
                alert('Error: ' + error.message);
            }
        };
        fetchCategories();
    }, []);

    const handlePartyCreationSubmit = async (event) => {
        event.preventDefault();
        console.log('creating party', playerId, category, rounds, timeout);
        try {
            const response = await fetch('/api/party/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    player_id: playerId,
                    category: category,
                    rounds: rounds,
                    timeout: timeout
                })
            });

            if (!response.ok) {
                console.log('error', response);
                throw new Error('Failed to initialize party');
            }
            const data = await response.json();
            console.log('data from party init', data);
            navigate(`/`);
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    // validate that playerId is not already in a party.  the playerId should be unique and not empty. etc.
    return (
        <main>
            <section className="container">
                <h3>Fun Friday - Create a Quiz</h3>
                <form onSubmit={handlePartyCreationSubmit}>
                    <label>
                        Category:
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            required
                        >
                            <option value="" disabled>Select a category</option>
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </label>
                    <br /><br />

                    <label>
                        Rounds:
                        <input
                            type="number"
                            value={rounds}
                            onChange={(e) => setRounds(parseInt(e.target.value, 10))}
                            required
                        />
                    </label>
                    <br /><br />

                    <label>
                        Timeout (seconds):
                        <input
                            type="number"
                            value={timeout}
                            onChange={(e) => setTimeout(parseInt(e.target.value, 10))}
                            required
                        />
                    </label>
                    <br /><br />

                    <button type="submit">Create Game</button>
                </form>
            </section>
        </main>
    );
}

export default GameCreationPage;