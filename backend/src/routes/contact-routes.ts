import { Router } from 'express';
import { ContactController } from '../controllers/contact-controller';

const contactRouter = Router();
const contactController = new ContactController();

// Rotas de contatos
contactRouter.get('/', contactController.listContacts.bind(contactController));
contactRouter.get('/:id', contactController.getContactById.bind(contactController));
contactRouter.post('/', contactController.createContact.bind(contactController));
contactRouter.put('/:id', contactController.updateContact.bind(contactController));
contactRouter.delete('/:id', contactController.deleteContact.bind(contactController));

export default contactRouter; 