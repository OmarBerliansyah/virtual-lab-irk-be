import { Hono } from 'hono';
import { Webhook } from 'svix';
import prisma, { Role } from '../lib/prisma';

const app = new Hono();

app.post('/clerk', async (c) => {
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
      return c.json({ error: 'Missing webhook secret' }, 500);
    }

    const svix_id = c.req.header('svix-id');
    const svix_timestamp = c.req.header('svix-timestamp');
    const svix_signature = c.req.header('svix-signature');

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return c.json({ error: 'Missing svix headers' }, 400);
    }

    const body = await c.req.text();

    const wh = new Webhook(WEBHOOK_SECRET);

    let evt: any;

    try {
      evt = wh.verify(body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      });
    } catch (err) {
      console.error('Error verifying webhook:', err);
      return c.json({ error: 'Webhook verification failed' }, 400);
    }

    const { type } = evt;
    console.log('Webhook received:', type, 'at', new Date().toISOString());
    console.log('Event data:', JSON.stringify(evt.data, null, 2));

    if (type === 'user.created') {
      const { id, email_addresses, created_at } = evt.data;

      try {
        const existingUser = await prisma.user.findUnique({ where: { clerkId: id } });
        if (existingUser) {
          console.log('User already exists:', existingUser.email);
          return c.json({ received: true, userId: existingUser.id, status: 'already_exists' });
        }

        const email = email_addresses[0]?.email_address || '';

        let role: Role = 'USER';
        if (email === '18223055@std.stei.itb.ac.id' || email === '18223005@std.stei.itb.ac.id') {
          role = 'ADMIN';
        }

        const user = await prisma.user.create({
          data: {
            clerkId: id,
            email,
            role
          }
        });

        console.log('User created via webhook:', user.email, 'with role:', user.role, 'ID:', user.id);
        return c.json({ received: true, userId: user.id, status: 'created', role: user.role });
      } catch (error) {
        console.error('Error creating user:', error);
        return c.json({ error: 'Failed to create user' }, 500);
      }
    } else if (type === 'session.created') {
      const { user_id } = evt.data;
      console.log('User signed in:', user_id);

      const existingUser = await prisma.user.findUnique({ where: { clerkId: user_id } });
      if (!existingUser) {
        console.log('User signed in but not found in database:', user_id);
      } else {
        console.log('User sign-in tracked:', existingUser.email);
      }

      return c.json({ received: true, status: 'session_tracked' });
    } else {
      console.log('Unhandled webhook type:', type);
      return c.json({ received: true, status: 'unhandled' });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

export default app;