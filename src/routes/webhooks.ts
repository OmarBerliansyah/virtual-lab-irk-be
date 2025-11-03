import { Router, Request, Response } from 'express';
import { User } from '../models';
import { Webhook } from 'svix';

const router = Router();

router.post('/clerk', async (req: Request, res: Response): Promise<void> => {
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    
    if (!WEBHOOK_SECRET) {
      res.status(500).json({ error: 'Missing webhook secret' });
      return;
    }

    // Get the headers
    const svix_id = req.headers['svix-id'] as string;
    const svix_timestamp = req.headers['svix-timestamp'] as string;
    const svix_signature = req.headers['svix-signature'] as string;

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      res.status(400).json({ error: 'Missing svix headers' });
      return;
    }

    // Get the body
    const body = JSON.stringify(req.body);

    // Create a new Svix instance with your secret.
    const wh = new Webhook(WEBHOOK_SECRET);

    let evt: any;

    // Verify the payload with the headers
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

    // Handle the webhook
    const { type } = evt;
    const { id, email_addresses, created_at } = evt.data;

    if (type === 'user.created') {
      try {
        // Create user in our database
        const user = await User.create({
          clerkId: id,
          email: email_addresses[0]?.email_address || '',
          role: 'user' // Default role
        });

        console.log('User created via webhook:', user.email);
        res.status(200).json({ received: true, userId: user._id });
      } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
      }
    } else {
      console.log('Unhandled webhook type:', type);
      res.status(200).json({ received: true });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;