import { readFileSync } from 'fs';

// Read .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const clerkMatch = envContent.match(/CLERK_SECRET_KEY=(.+)/);
const CLERK_SECRET_KEY = clerkMatch ? clerkMatch[1].trim() : null;

if (!CLERK_SECRET_KEY) {
  console.log('CLERK_SECRET_KEY not found in .env.local');
  process.exit(1);
}

async function updateUserRole(email, newRole) {
  console.log('\n--- Updating', email, 'to', newRole, '---');

  const searchResponse = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`, {
    headers: { 'Authorization': `Bearer ${CLERK_SECRET_KEY}` }
  });
  const users = await searchResponse.json();

  if (users.errors) {
    console.log('Error:', users.errors);
    return;
  }

  if (!users.data || users.data.length === 0) {
    console.log('User not found in Clerk');
    return;
  }

  const user = users.data[0];
  console.log('Clerk user ID:', user.id);
  console.log('Current role:', user.public_metadata?.role || 'not set');

  console.log('Updating role to', newRole, '...');
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
  if (updated.errors) {
    console.log('Update error:', updated.errors);
  } else {
    console.log('SUCCESS! Role updated to:', updated.public_metadata?.role);
  }
}

async function main() {
  // Jaryd - change from host to admin
  await updateUserRole('jaryd@liveplaymobile.com', 'admin');

  // Jess - note: her Clerk email is jessica@ not jess@
  await updateUserRole('jessica@liveplaymobile.com', 'talent');
}

main();
