#!/usr/bin/env node
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const DB_URL = 'postgres://iftar_user:iftar_secure_pass_2026@localhost:5432/iftar_db';
const CONTAINER = 'io4gs04gskogggg40g8s0s00';

function escape(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function runSQL(sql) {
  execSync(`docker exec ${CONTAINER} psql -U iftar_user -d iftar_db -c "${sql.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
}

// Import users
console.log('Importing users...');
const users = JSON.parse(readFileSync('./data/users.json', 'utf-8'));
for (const u of users) {
  const sql = `INSERT INTO users (id, telegram_id, username, first_name, last_name, avatar_url, created_at, updated_at) 
    VALUES (${escape(u.id)}, ${u.telegram_id}, ${escape(u.username)}, ${escape(u.first_name)}, ${escape(u.last_name)}, ${escape(u.avatar_url)}, ${escape(u.created_at)}, ${escape(u.updated_at || u.created_at)}) 
    ON CONFLICT (id) DO NOTHING`;
  runSQL(sql);
}
console.log(`Imported ${users.length} users`);

// Import events
console.log('Importing events...');
const events = JSON.parse(readFileSync('./data/events.json', 'utf-8'));
for (const e of events) {
  const sql = `INSERT INTO events (id, host_id, date, iftar_time, location, address, notes, created_at, updated_at) 
    VALUES (${escape(e.id)}, ${escape(e.host_id)}, ${escape(e.date)}, ${escape(e.iftar_time)}, ${escape(e.location)}, ${escape(e.address)}, ${escape(e.notes)}, ${escape(e.created_at)}, ${escape(e.updated_at || e.created_at)}) 
    ON CONFLICT (id) DO NOTHING`;
  runSQL(sql);
}
console.log(`Imported ${events.length} events`);

// Import invitations
console.log('Importing invitations...');
const invitations = JSON.parse(readFileSync('./data/invitations.json', 'utf-8'));
for (const i of invitations) {
  const sql = `INSERT INTO invitations (id, event_id, guest_id, guest_username, status, guest_count, responded_at, created_at) 
    VALUES (${escape(i.id)}, ${escape(i.event_id)}, ${escape(i.guest_id)}, ${escape(i.guest_username)}, ${escape(i.status)}, ${i.guest_count || 1}, ${escape(i.responded_at)}, ${escape(i.created_at)}) 
    ON CONFLICT (id) DO NOTHING`;
  runSQL(sql);
}
console.log(`Imported ${invitations.length} invitations`);

console.log('Done!');
