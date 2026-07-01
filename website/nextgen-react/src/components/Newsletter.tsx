import { useState } from 'react';
import { QUERY_API_BASE } from '../config';

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    setSubscribed(true);
    
    try {
      await fetch(`${QUERY_API_BASE}/api/queries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Newsletter Subscriber',
          email: email.trim(),
          phone: '',
          exam: 'General',
          message: 'Signed up for newsletter resources & tips.',
          type: 'Newsletter'
        })
      });
    } catch (error) {
      console.error('Error submitting newsletter email:', error);
    }
    
    setEmail('');
  };

  return (
    <section className="newsletter shell" id="resources">
      <div>
        <h2>Stay Updated with Free Resources &amp; Tips</h2>
        <p>Get study tips, resources, and exam updates delivered to your inbox.</p>
      </div>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setSubscribed(false); }}
        />
        <button className="btn btn-primary" type="submit">
          {subscribed ? 'Subscribed' : 'Subscribe'}
        </button>
      </form>
    </section>
  );
}
