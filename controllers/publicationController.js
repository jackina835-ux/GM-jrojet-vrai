const { Publication, Store, User } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const fs = require('fs');

// === CRÉER UNE PUBLICATION ===
exports.createPublication = async (req, res) => {
  try {
    console.log('📝 Création d\'une publication...');
    console.log('Body:', req.body);
    console.log('File:', req.file);

    const { storeId, legend, duration, isPermanent } = req.body;
    
    // Vérifier la photo
    if (!req.file) {
      console.log('❌ Aucun fichier reçu');
      return res.status(400).json({
        success: false,
        message: 'La photo est requise'
      });
    }

    // Récupérer le chemin de la photo
    const photoPath = req.file.path.replace(/\\/g, '/');
    console.log('📸 Photo sauvegardée:', photoPath);

    // Calculer la date d'expiration
    let expiresAt = null;
    if (!isPermanent || isPermanent === 'false') {
      const durationHours = parseInt(duration) || 4;
      expiresAt = moment().add(durationHours, 'hours').toDate();
    }

    // Créer la publication
    const publication = await Publication.create({
      store_id: parseInt(storeId),
      legend: legend || '',
      photo: photoPath,
      duration: parseInt(duration) || 4,
      is_permanent: isPermanent === 'true' || isPermanent === true,
      expires_at: expiresAt,
      is_active: true,
      is_draft: false
    });

    console.log('✅ Publication créée:', publication.id);

    res.status(201).json({
      success: true,
      publication
    });
  } catch (error) {
    console.error('❌ Create publication error:', error);
    // Supprimer le fichier uploadé en cas d'erreur
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Erreur suppression fichier:', err);
      }
    }
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la publication',
      error: error.message
    });
  }
};

// === METTRE À JOUR UNE PUBLICATION ===
exports.updatePublication = async (req, res) => {
  try {
    const { id } = req.params;
    const { legend, duration, isPermanent } = req.body;

    const publication = await Publication.findByPk(id);
    if (!publication) {
      return res.status(404).json({
        success: false,
        message: 'Publication non trouvée'
      });
    }

    const updates = {};
    if (legend) updates.legend = legend;
    if (duration) updates.duration = parseInt(duration);
    if (isPermanent !== undefined) {
      updates.is_permanent = isPermanent === 'true' || isPermanent === true;
    }

    // Gérer la nouvelle photo si fournie
    if (req.file) {
      // Supprimer l'ancienne photo
      if (publication.photo) {
        try {
          fs.unlinkSync(publication.photo);
        } catch (err) {
          console.error('Erreur suppression ancienne photo:', err);
        }
      }
      updates.photo = req.file.path.replace(/\\/g, '/');
    }

    // Mettre à jour la date d'expiration
    if (duration || isPermanent !== undefined) {
      const isPerm = updates.is_permanent !== undefined ? updates.is_permanent : publication.is_permanent;
      if (isPerm) {
        updates.expires_at = null;
      } else {
        const durationHours = parseInt(duration) || publication.duration || 4;
        updates.expires_at = moment().add(durationHours, 'hours').toDate();
      }
    }

    await publication.update(updates);

    res.json({
      success: true,
      publication
    });
  } catch (error) {
    console.error('Update publication error:', error);
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Erreur suppression fichier:', err);
      }
    }
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la publication',
      error: error.message
    });
  }
};

// === RÉCUPÉRER TOUTES LES PUBLICATIONS GLOBALES ===
exports.getGlobalPublications = async (req, res) => {
  try {
    const publications = await Publication.findAll({
      where: {
        is_active: true,
        is_draft: false,
        [Op.or]: [
          { is_permanent: true },
          { expires_at: { [Op.gt]: moment().toDate() } }
        ]
      },
      include: [
        {
          model: Store,
          include: [
            { model: User, attributes: ['id', 'name', 'avatar'] }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 50
    });

    // Formater les URLs des photos
    const formattedPublications = publications.map(pub => ({
      ...pub.toJSON(),
      photo: pub.photo ? `/uploads/${pub.photo.split('/').pop()}` : null
    }));

    res.json({
      success: true,
      publications: formattedPublications
    });
  } catch (error) {
    console.error('Get global publications error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des publications'
    });
  }
};

// === RÉCUPÉRER LES PUBLICATIONS D'UN MAGASIN ===
exports.getStorePublications = async (req, res) => {
  try {
    const { storeId } = req.params;
    
    const publications = await Publication.findAll({
      where: {
        store_id: storeId,
        is_active: true,
        is_draft: false,
        [Op.or]: [
          { is_permanent: true },
          { expires_at: { [Op.gt]: moment().toDate() } }
        ]
      },
      order: [['created_at', 'DESC']]
    });

    const formattedPublications = publications.map(pub => ({
      ...pub.toJSON(),
      photo: pub.photo ? `/uploads/${pub.photo.split('/').pop()}` : null
    }));

    res.json({
      success: true,
      publications: formattedPublications
    });
  } catch (error) {
    console.error('Get store publications error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des publications'
    });
  }
};

// === SUPPRIMER UNE PUBLICATION ===
exports.deletePublication = async (req, res) => {
  try {
    const { id } = req.params;
    
    const publication = await Publication.findByPk(id);
    if (!publication) {
      return res.status(404).json({
        success: false,
        message: 'Publication non trouvée'
      });
    }

    // Supprimer la photo
    if (publication.photo) {
      try {
        fs.unlinkSync(publication.photo);
      } catch (err) {
        console.error('Erreur suppression photo:', err);
      }
    }

    await publication.destroy();

    res.json({
      success: true,
      message: 'Publication supprimée avec succès'
    });
  } catch (error) {
    console.error('Delete publication error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la publication'
    });
  }
};

// === RÉCUPÉRER LES BROUILLONS ===
exports.getDrafts = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const store = await Store.findOne({ 
      where: { vendor_id: vendorId } 
    });
    
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    const drafts = await Publication.findAll({
      where: {
        store_id: store.id,
        is_draft: true,
        is_active: false
      },
      order: [['created_at', 'DESC']]
    });

    const formattedDrafts = drafts.map(draft => ({
      ...draft.toJSON(),
      photo: draft.photo ? `/uploads/${draft.photo.split('/').pop()}` : null
    }));

    res.json({
      success: true,
      drafts: formattedDrafts
    });
  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des brouillons'
    });
  }
};

// === REPUBLIER UN BROUILLON ===
exports.republishFromDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const { duration } = req.body;

    const publication = await Publication.findByPk(id);
    if (!publication) {
      return res.status(404).json({
        success: false,
        message: 'Publication non trouvée'
      });
    }

    const durationHours = parseInt(duration) || 4;
    const expiresAt = moment().add(durationHours, 'hours').toDate();

    await publication.update({
      is_active: true,
      is_draft: false,
      duration: durationHours,
      expires_at: expiresAt,
      is_permanent: false
    });

    res.json({
      success: true,
      publication
    });
  } catch (error) {
    console.error('Republish from draft error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la republication'
    });
  }
};

// === RECHERCHER UNE PUBLICATION ===
exports.searchPublications = async (req, res) => {
  try {
    const { q } = req.query;
    
    const publications = await Publication.findAll({
      where: {
        is_active: true,
        is_draft: false,
        [Op.or]: [
          { legend: { [Op.like]: `%${q}%` } },
          { '$Store.name$': { [Op.like]: `%${q}%` } }
        ],
        [Op.or]: [
          { is_permanent: true },
          { expires_at: { [Op.gt]: moment().toDate() } }
        ]
      },
      include: [
        {
          model: Store,
          include: [
            { model: User, attributes: ['id', 'name', 'avatar'] }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const formattedPublications = publications.map(pub => ({
      ...pub.toJSON(),
      photo: pub.photo ? `/uploads/${pub.photo.split('/').pop()}` : null
    }));

    res.json({
      success: true,
      publications: formattedPublications
    });
  } catch (error) {
    console.error('Search publications error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche'
    });
  }
};