const { Department, Store, Vendor, User } = require('../models');
const { Op } = require('sequelize');

// ============================================
// ROUTES PUBLIQUES
// ============================================

/**
 * Récupérer tous les départements actifs
 * Un département est actif si au moins un vendeur l'a choisi
 */
exports.getActiveDepartments = async (req, res) => {
    try {
        const departments = await Department.findAll({
            where: { is_active: true },
            include: [
                {
                    model: Store,
                    as: 'stores',
                    attributes: ['id', 'name', 'logo'],
                    include: [
                        {
                            model: Vendor,
                            include: [
                                { model: User, attributes: ['id', 'name', 'avatar'] }
                            ]
                        }
                    ]
                }
            ],
            order: [['name', 'ASC']]
        });

        // Compter le nombre de magasins par département
        const formattedDepartments = departments.map(dept => {
            const stores = dept.stores || [];
            return {
                id: dept.id,
                name: dept.name,
                icon: dept.icon,
                is_active: dept.is_active,
                storeCount: stores.length,
                stores: stores.map(store => ({
                    id: store.id,
                    name: store.name,
                    logo: store.logo,
                    vendor: store.Vendor?.User?.name || 'Vendeur'
                }))
            };
        });

        res.json({
            success: true,
            departments: formattedDepartments
        });
    } catch (error) {
        console.error('Get active departments error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des départements actifs'
        });
    }
};

/**
 * Récupérer tous les départements (actifs et inactifs)
 */
exports.getAllDepartments = async (req, res) => {
    try {
        const departments = await Department.findAll({
            include: [
                {
                    model: Store,
                    as: 'stores',
                    attributes: ['id', 'name', 'logo']
                }
            ],
            order: [['name', 'ASC']]
        });

        const formattedDepartments = departments.map(dept => ({
            id: dept.id,
            name: dept.name,
            icon: dept.icon,
            is_active: dept.is_active,
            storeCount: dept.stores?.length || 0,
            created_at: dept.created_at,
            updated_at: dept.updated_at
        }));

        res.json({
            success: true,
            departments: formattedDepartments
        });
    } catch (error) {
        console.error('Get all departments error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des départements'
        });
    }
};

/**
 * Récupérer un département par son ID
 */
exports.getDepartmentById = async (req, res) => {
    try {
        const { departmentId } = req.params;

        const department = await Department.findByPk(departmentId, {
            include: [
                {
                    model: Store,
                    as: 'stores',
                    include: [
                        {
                            model: Vendor,
                            include: [
                                { model: User, attributes: ['id', 'name', 'avatar'] }
                            ]
                        }
                    ]
                }
            ]
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Département non trouvé'
            });
        }

        res.json({
            success: true,
            department: {
                id: department.id,
                name: department.name,
                icon: department.icon,
                is_active: department.is_active,
                stores: department.stores || [],
                created_at: department.created_at,
                updated_at: department.updated_at
            }
        });
    } catch (error) {
        console.error('Get department by id error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du département'
        });
    }
};

/**
 * Récupérer tous les magasins d'un département
 */
exports.getDepartmentStores = async (req, res) => {
    try {
        const { departmentId } = req.params;

        const department = await Department.findByPk(departmentId);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Département non trouvé'
            });
        }

        const stores = await Store.findAll({
            where: { 
                department_id: departmentId,
                is_active: true 
            },
            include: [
                {
                    model: Vendor,
                    include: [
                        { model: User, attributes: ['id', 'name', 'avatar'] }
                    ]
                }
            ],
            order: [['name', 'ASC']]
        });

        res.json({
            success: true,
            department: department.name,
            stores
        });
    } catch (error) {
        console.error('Get department stores error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des magasins du département'
        });
    }
};

/**
 * Vérifier si un département est actif
 */
exports.checkDepartmentActive = async (req, res) => {
    try {
        const { departmentId } = req.params;

        const department = await Department.findByPk(departmentId);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Département non trouvé'
            });
        }

        res.json({
            success: true,
            isActive: department.is_active
        });
    } catch (error) {
        console.error('Check department active error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la vérification du département'
        });
    }
};

/**
 * Rechercher un département par nom
 */
exports.searchDepartments = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez fournir un terme de recherche'
            });
        }

        const departments = await Department.findAll({
            where: {
                name: { [Op.like]: `%${q}%` }
            },
            include: [
                {
                    model: Store,
                    as: 'stores',
                    attributes: ['id', 'name', 'logo']
                }
            ],
            order: [['name', 'ASC']],
            limit: 20
        });

        res.json({
            success: true,
            departments
        });
    } catch (error) {
        console.error('Search departments error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la recherche des départements'
        });
    }
};

// ============================================
// ROUTES PROTÉGÉES (Vendeur)
// ============================================

/**
 * Récupérer les départements disponibles (non attribués)
 */
exports.getAvailableDepartments = async (req, res) => {
    try {
        // Récupérer tous les départements
        const allDepartments = await Department.findAll({
            order: [['name', 'ASC']]
        });

        // Récupérer les départements déjà attribués à un magasin
        const usedDepartments = await Store.findAll({
            attributes: ['department_id'],
            group: ['department_id']
        });

        const usedIds = usedDepartments.map(s => s.department_id);

        // Filtrer les départements disponibles
        const available = allDepartments.filter(d => !usedIds.includes(d.id));

        res.json({
            success: true,
            departments: available
        });
    } catch (error) {
        console.error('Get available departments error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des départements disponibles'
        });
    }
};

/**
 * Sélectionner un département pour créer son magasin
 */
exports.selectDepartment = async (req, res) => {
    try {
        const { vendorId, departmentId, storeName, description, contact } = req.body;
        const logo = req.file ? req.file.path : null;

        // Vérifier que le vendeur existe
        const vendor = await Vendor.findByPk(vendorId);
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendeur non trouvé'
            });
        }

        // Vérifier que le vendeur n'a pas déjà un magasin
        const existingStore = await Store.findOne({ 
            where: { vendor_id: vendorId } 
        });
        if (existingStore) {
            return res.status(400).json({
                success: false,
                message: 'Ce vendeur a déjà un magasin'
            });
        }

        // Vérifier que le département existe
        const department = await Department.findByPk(departmentId);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Département non trouvé'
            });
        }

        // Vérifier que le département n'est pas déjà attribué
        const departmentTaken = await Store.findOne({ 
            where: { department_id: departmentId } 
        });
        if (departmentTaken) {
            return res.status(400).json({
                success: false,
                message: 'Ce département est déjà attribué à un autre vendeur'
            });
        }

        // Créer le magasin
        const store = await Store.create({
            vendor_id: vendorId,
            department_id: departmentId,
            name: storeName,
            logo: logo || null,
            description: description || null,
            contact: contact || null,
            is_active: true
        });

        // Activer le département
        await Department.update(
            { is_active: true },
            { where: { id: departmentId } }
        );

        res.status(201).json({
            success: true,
            message: 'Magasin créé avec succès',
            store: {
                id: store.id,
                name: store.name,
                logo: store.logo,
                department: department.name,
                department_id: department.id
            }
        });
    } catch (error) {
        console.error('Select department error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la sélection du département'
        });
    }
};

// ============================================
// ROUTES ADMIN
// ============================================

/**
 * Créer un nouveau département (admin)
 */
exports.createDepartment = async (req, res) => {
    try {
        const { name } = req.body;
        const icon = req.file ? req.file.path : null;

        // Vérifier si le département existe déjà
        const existing = await Department.findOne({ where: { name } });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Ce département existe déjà'
            });
        }

        const department = await Department.create({
            name,
            icon,
            is_active: false
        });

        res.status(201).json({
            success: true,
            department
        });
    } catch (error) {
        console.error('Create department error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du département'
        });
    }
};

/**
 * Mettre à jour un département (admin)
 */
exports.updateDepartment = async (req, res) => {
    try {
        const { departmentId } = req.params;
        const { name } = req.body;
        const icon = req.file ? req.file.path : null;

        const department = await Department.findByPk(departmentId);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Département non trouvé'
            });
        }

        const updates = {};
        if (name) updates.name = name;
        if (icon) updates.icon = icon;

        await department.update(updates);

        res.json({
            success: true,
            department
        });
    } catch (error) {
        console.error('Update department error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du département'
        });
    }
};

/**
 * Supprimer un département (admin)
 */
exports.deleteDepartment = async (req, res) => {
    try {
        const { departmentId } = req.params;

        const department = await Department.findByPk(departmentId);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Département non trouvé'
            });
        }

        // Vérifier si des magasins utilisent ce département
        const stores = await Store.count({ 
            where: { department_id: departmentId } 
        });

        if (stores > 0) {
            return res.status(400).json({
                success: false,
                message: 'Impossible de supprimer ce département car il est utilisé par des magasins'
            });
        }

        await department.destroy();

        res.json({
            success: true,
            message: 'Département supprimé avec succès'
        });
    } catch (error) {
        console.error('Delete department error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression du département'
        });
    }
};

/**
 * Activer/Désactiver un département (admin)
 */
exports.toggleDepartmentActive = async (req, res) => {
    try {
        const { departmentId } = req.params;
        const { isActive } = req.body;

        const department = await Department.findByPk(departmentId);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Département non trouvé'
            });
        }

        await department.update({ is_active: isActive });

        res.json({
            success: true,
            department,
            message: isActive ? 'Département activé' : 'Département désactivé'
        });
    } catch (error) {
        console.error('Toggle department active error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la modification du statut du département'
        });
    }
};

// ============================================
// ROUTES STATISTIQUES (admin)
// ============================================

/**
 * Récupérer les statistiques des départements (admin)
 */
exports.getDepartmentStats = async (req, res) => {
    try {
        const departments = await Department.findAll({
            include: [
                {
                    model: Store,
                    as: 'stores',
                    include: [
                        { model: Vendor }
                    ]
                }
            ]
        });

        const stats = departments.map(dept => ({
            id: dept.id,
            name: dept.name,
            is_active: dept.is_active,
            storeCount: dept.stores?.length || 0,
            vendorCount: dept.stores?.filter(s => s.Vendor).length || 0
        }));

        // Total
        const total = {
            totalDepartments: departments.length,
            activeDepartments: departments.filter(d => d.is_active).length,
            totalStores: departments.reduce((sum, d) => sum + (d.stores?.length || 0), 0)
        };

        res.json({
            success: true,
            stats,
            total
        });
    } catch (error) {
        console.error('Get department stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques'
        });
    }
};
