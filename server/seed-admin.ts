import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "../shared/schema";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool, { schema });

async function seedAdmin() {
  try {
    console.log('Creating admin user...');
    
    const passwordHash = await bcrypt.hash('admin123', 10);
    
    const [adminUser] = await db.insert(schema.users).values({
      phone: '+998901234567',
      passwordHash,
      displayName: 'System Administrator',
      roles: ['admin'],
      defaultRole: 'admin',
      userType: 'individual',
      email: 'admin@yukbor.uz',
    }).returning();

    await db.insert(schema.profiles).values({
      userId: adminUser.id,
    });

    console.log('Admin user created successfully!');
    console.log('Phone: +998901234567');
    console.log('Password: admin123');
    console.log('Please change this password after first login!');
    
    await pool.end();
  } catch (error) {
    console.error('Error seeding admin:', error);
    await pool.end();
    process.exit(1);
  }
}

seedAdmin();
