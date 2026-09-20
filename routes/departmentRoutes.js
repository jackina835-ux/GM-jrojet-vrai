const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { requireVendor } = require('../middlewares/actorMiddleware');
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

// Creation du magasin du vendeur CONNECTE : requireVendor retrouve le
// vendeur depuis le jeton (req.vendor), plus de vendorId dans le corps.
// requireVendor passe AVANT multer : un non-vendeur ne peut rien uploader.
router.post(
  '/select',
  authMiddleware,
  ...requireVendor,
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
