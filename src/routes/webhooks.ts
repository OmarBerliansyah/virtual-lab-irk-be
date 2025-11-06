import { Router, Request, Response } from 'express';
import { User } from '../models';
import { Webhook } from 'svix';

const router = Router();

// router.get('/test', (req: Request, res: Response) => {
//   res.status(200).json({ 
//     message: 'Webhook endpoint is reachable!', 
//     timestamp: new Date().toISOString(),
//     url: req.originalUrl 
//   });
// });

router.post('/clerk', async (req: Request, res: Response): Promise<void> => {
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    
    if (!WEBHOOK_SECRET) {
      res.status(500).json({ error: 'Missing webhook secret' });
      return;
    }

    const svix_id = req.headers['svix-id'] as string;
    const svix_timestamp = req.headers['svix-timestamp'] as string;
    const svix_signature = req.headers['svix-signature'] as string;

    if (!svix_id || !svix_timestamp || !svix_signature) {
      res.status(400).json({ error: 'Missing svix headers' });
      return;
    }

    const body = JSON.stringify(req.body);

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
      res.status(400).json({ error: 'Webhook verification failed' });
      return;
    }

    const { type } = evt;
    console.log('Webhook received:', type, 'at', new Date().toISOString());
    console.log('Event data:', JSON.stringify(evt.data, null, 2));

    if (type === 'user.created') {
      const { id, email_addresses, created_at } = evt.data;
      
      try {
        const existingUser = await User.findOne({ clerkId: id });
        if (existingUser) {
          console.log('User already exists:', existingUser.email);
          res.status(200).json({ received: true, userId: existingUser._id, status: 'already_exists' });
          return;
        }

        const email = email_addresses[0]?.email_address || '';
        
        let role = 'user';
        if (email === '18223055@std.stei.itb.ac.id' || email === '18223005@std.stei.itb.ac.id') {
          role = 'admin';
        }

        const user = await User.create({
          clerkId: id,
          email,
          role
        });

        console.log('User created via webhook:', user.email, 'with role:', user.role, 'ID:', user._id);
        res.status(200).json({ received: true, userId: user._id, status: 'created', role: user.role });
      } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
      }
    } else if (type === 'session.created') {
      const { user_id } = evt.data;
      console.log('User signed in:', user_id);
      
      // Check if user exists in our database
      const existingUser = await User.findOne({ clerkId: user_id });
      if (!existingUser) {
        console.log('User signed in but not found in database:', user_id);
      } else {
        console.log('User sign-in tracked:', existingUser.email);
      }
      
      res.status(200).json({ received: true, status: 'session_tracked' });
    } else {
      console.log('Unhandled webhook type:', type);
      res.status(200).json({ received: true, status: 'unhandled' });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;