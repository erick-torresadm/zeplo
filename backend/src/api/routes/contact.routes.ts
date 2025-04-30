import { Router } from 'express';
import { AuthRequest } from '../../types/user';
import { Response } from 'express';
import { contactController } from '../../controllers/contact';

const router = Router();

// Get all contacts
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const contacts = await contactController.getAllContacts(req.user?.id);
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get contact by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const contact = await contactController.getContact(parseInt(req.params.id), req.user?.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create contact
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const contact = await contactController.createContact(req.body, req.user?.id);
    res.status(201).json(contact);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update contact
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const contact = await contactController.updateContact(parseInt(req.params.id), req.body, req.user?.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete contact
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await contactController.deleteContact(parseInt(req.params.id), req.user?.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router; 