require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('--- Environment Check ---');
console.log('URL:', url);
console.log('URL is Placeholder:', url === 'https://syrhaykzsknfitgithmn.supabase.co');
console.log('Anon Key Start:', anonKey?.substring(0, 50));
console.log('Service Key Start:', serviceKey?.substring(0, 50));
console.log('--- Placeholder Check ---');
const placeholderAnon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5cmhheWt6c2tuZml0Z2l0aG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMzExNTUsImV4cCI6MjA3NzcwNzE1NX0";
const placeholderService = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5cmhheWt6c2tuZml0Z2l0aG1uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjEzMTE1NSwiZXhwIjoyMDc3NzA3MTU1fQ";

console.log('Anon matches placeholder:', anonKey?.startsWith(placeholderAnon));
console.log('Service matches placeholder:', serviceKey?.startsWith(placeholderService));
console.log('-------------------------');
