import UserProfile from '../../app/components/UserProfile';
import ThemeToggle from '../../app/components/ThemeToggle';

export default function ProfilePage() {
  return (
    <main className="min-h-screen" style={{background: 'var(--background)', color: 'var(--foreground)'}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem'}}>
        <h1 style={{margin: 0}}>Profile</h1>
        <ThemeToggle />
      </div>
      <UserProfile />
    </main>
  );
}
