import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// TODO - shouldnt be able to get to this page if already in a party, should be redirected to lobby if not logged in
function GameCreationPage() {
    const [state, setState] = useState({
        playerId: localStorage.getItem('playerId') || '',
        category: '',
        rounds: 1,
        timeout: 30,
        categories: []
    });
    const navigate = useNavigate();
    const categoryRef = useRef();
    const roundsRef = useRef();
    const timeoutRef = useRef();

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await fetch('/api/categories');
                if (!response.ok) {
                    throw new Error('Failed to fetch categories');
                }
                const data = await response.json();
                setState(prevState => ({ ...prevState, categories: data.categories }));
            } catch (error) {
                alert('Error: ' + error.message);
            }
        };
        fetchCategories();
    }, []);

    const handlePartyCreationSubmit = async (event) => {
        event.preventDefault();
        const playerId = state.playerId;
        const category = categoryRef.current.value;
        const rounds = parseInt(roundsRef.current.value, 10);
        const timeout = parseInt(timeoutRef.current.value, 10);
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
                            ref={categoryRef}
                            defaultValue={state.category}
                            required
                        >
                            <option value="" disabled>Select a category</option>
                            {state.categories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </label>
                    <br /><br />

                    <label>
                        Rounds:
                        <input
                            type="number"
                            ref={roundsRef}
                            defaultValue={state.rounds}
                            required
                        />
                    </label>
                    <br /><br />

                    <label>
                        Timeout (seconds):
                        <input
                            type="number"
                            ref={timeoutRef}
                            defaultValue={state.timeout}
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