import { readFileSync } from 'fs';

// Read .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const clerkMatch = envContent.match(/CLERK_SECRET_KEY=(.+)/);
const CLERK_SECRET_KEY = clerkMatch ? clerkMatch[1].trim() : null;

if (!CLERK_SECRET_KEY) {
  console.log('CLERK_SECRET_KEY not found in .env.local');
  process.exit(1);
}
const email = process.argv[2];
const newRole = process.argv[3];

if (!email || !newRole) {
  console.log('Usage: node scripts/update-clerk-role.mjs <email> <role>');
  process.exit(1);
}

async function updateRole() {
  // Find user by email
  const searchResponse = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`, {
    headers: { 'Authorization': `Bearer ${CLERK_SECRET_KEY}` }
  });
  const users = await searchResponse.json();

  if (!users.data || users.data.length === 0) {
    console.log('User not found in Clerk for email:', email);
    return;
  }

  const user = users.data[0];
  console.log('Found Clerk user:', user.id);
  console.log('Current role:', user.public_metadata?.role || 'not set');

  // Update role
  const updateResponse = await fetch(`https://api.clerk.com/v1/users/${user.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      public_metadata: { role: newRole }
    })
  });

  const updated = await updateResponse.json();
  console.log('Updated role to:', updated.public_metadata?.role);
}

updateRole();
