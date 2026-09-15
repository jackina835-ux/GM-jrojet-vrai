const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
// ✅ IMPORT CORRECT
const { upload, handleUploadError } = require('../middlewares/uploadMiddleware');

// Routes publiques
// Chemins fixes AVANT les routes parametrees (/:departmentId), sinon
// Express interprete "search"/"active" comme une valeur de departmentId.
router.get('/active', departmentController.getActiveDepartments);
router.get('/search', departmentController.searchDepartments);

// Routes vendeur (chemin fixe /available, doit aussi precéder /:departmentId)
router.get('/available', authMiddleware, roleMiddleware(['vendor']), departmentController.getAvailableDepartments);

router.get('/', departmentController.getAllDepartments);
router.get('/:departmentId', departmentController.getDepartmentById);
router.get('/:departmentId/stores', departmentController.getDepartmentStores);
router.get('/:departmentId/active', departmentController.checkDepartmentActive);

// ✅ CORRIGÉ
router.post(
  '/select', 
  authMiddleware, 
  roleMiddleware(['vendor']), 
  upload.single('logo'), 
  handleUploadError,
  departmentController.selectDepartment
);

// Routes admin - ✅ CORRIGÉ
router.post(
  '/', 
  authMiddleware, 
  roleMiddleware(['admin']), 
  upload.single('icon'), 
  handleUploadError,
  departmentController.createDepartment
);

// ✅ CORRIGÉ
router.put(
  '/:departmentId', 
  authMiddleware, 
  roleMiddleware(['admin']), 
  upload.single('icon'), 
  handleUploadError,
  departmentController.updateDepartment
);

router.delete('/:departmentId', authMiddleware, roleMiddleware(['admin']), departmentController.deleteDepartment);
router.post('/:departmentId/activate', authMiddleware, roleMiddleware(['admin']), departmentController.toggleDepartmentActive);

module.exports = router;