const { Publication, PublicationPhoto, Store, User, Vendor, Buyer, Follow } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const fs = require('fs');

// === CRÉER UNE PUBLICATION ===
exports.createPublication = async (req, res) => {
  try {
    console.log('📝 Création d\'une publication...');
    console.log('Body:', req.body);
    console.log('Files:', req.files);

    const { storeId, legend, duration, isPermanent, price, category } = req.body;
    
    // Vérifier les photos (upload.array -> req.files, plusieurs possibles)
    if (!req.files || req.files.length === 0) {
      console.log('❌ Aucun fichier reçu');
      return res.status(400).json({
        success: false,
        message: 'Au moins une photo est requise'
      });
    }

    // Chaque chemin recupere avec un / en tete, pour former une URL
    // publique correcte via /uploads/... une fois relu plus tard.
    const photoPaths = req.files.map((f) => '/' + f.path.replace(/\\/g, '/'));
    console.log('📸 Photos sauvegardées:', photoPaths);

    // La premiere photo reste la "couverture" (compatibilite avec le
    // reste de l'app qui n'affiche qu'une seule image par publication).
    const photoPath = photoPaths[0];

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
      price: price ? parseFloat(price) : null,
      category: category || null,
      duration: parseInt(duration) || 4,
      is_permanent: isPermanent === 'true' || isPermanent === true,
      expires_at: expiresAt,
      is_active: true,
      is_draft: false
    });

    // Enregistrer toutes les photos (y compris la premiere) dans la
    // galerie de la publication, pour l'affichage multi-photos.
    await PublicationPhoto.bulkCreate(
      photoPaths.map((photo, index) => ({
        publication_id: publication.id,
        photo,
        position: index,
      }))
    );

    console.log('✅ Publication créée:', publication.id);

    res.status(201).json({
      success: true,
      publication
    });
  } catch (error) {
    console.error('❌ Create publication error:', error);
    // Supprimer les fichiers uploadés en cas d'erreur
    if (req.files) {
      req.files.forEach((f) => {
        try {
          fs.unlinkSync(f.path);
        } catch (err) {
          console.error('Erreur suppression fichier:', err);
        }
      });
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
    const { legend, duration, isPermanent, price, category } = req.body;

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
    if (price !== undefined) updates.price = price ? parseFloat(price) : null;
    if (category !== undefined) updates.category = category || null;
    if (isPermanent !== undefined) {
      updates.is_permanent = isPermanent === 'true' || isPermanent === true;
    }

    // Gérer les nouvelles photos si fournies (remplace toute la galerie)
    if (req.files && req.files.length > 0) {
      // Supprimer les anciennes photos (fichiers + lignes de galerie)
      const oldPhotos = await PublicationPhoto.findAll({ where: { publication_id: id } });
      oldPhotos.forEach((p) => {
        try {
          fs.unlinkSync('.' + p.photo);
        } catch (err) {
          console.error('Erreur suppression ancienne photo:', err);
        }
      });
      await PublicationPhoto.destroy({ where: { publication_id: id } });

      const photoPaths = req.files.map((f) => '/' + f.path.replace(/\\/g, '/'));
      updates.photo = photoPaths[0];

      await PublicationPhoto.bulkCreate(
        photoPaths.map((photo, index) => ({
          publication_id: id,
          photo,
          position: index,
        }))
      );
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
            {
              model: Vendor,
              include: [{ model: User, attributes: ['id', 'name', 'avatar'] }],
            },
          ],
        },
        {
          model: PublicationPhoto,
          separate: true,
          order: [['position', 'ASC']],
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 50
    });

    // Formater les URLs des photos
    const formattedPublications = publications.map(pub => ({
      ...pub.toJSON(),
      photo: pub.photo || null,
      photos: (pub.PublicationPhotos || []).map((p) => p.photo)
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
      include: [
        {
          model: PublicationPhoto,
          separate: true,
          order: [['position', 'ASC']],
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const formattedPublications = publications.map(pub => ({
      ...pub.toJSON(),
      photo: pub.photo || null,
      photos: (pub.PublicationPhotos || []).map((p) => p.photo)
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

    // Supprimer la photo de couverture (le chemin stocké commence par un
    // "/" pour former une URL publique, donc il faut re-ajouter un "."
    // devant pour retrouver le vrai chemin de fichier local)
    if (publication.photo) {
      try {
        fs.unlinkSync('.' + publication.photo);
      } catch (err) {
        console.error('Erreur suppression photo:', err);
      }
    }

    // Supprimer aussi toutes les photos de la galerie
    const galleryPhotos = await PublicationPhoto.findAll({ where: { publication_id: id } });
    galleryPhotos.forEach((p) => {
      try {
        fs.unlinkSync('.' + p.photo);
      } catch (err) {
        console.error('Erreur suppression photo galerie:', err);
      }
    });

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
      photo: draft.photo || null
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
            {
              model: Vendor,
              include: [{ model: User, attributes: ['id', 'name', 'avatar'] }],
            },
          ],
        },
        {
          model: PublicationPhoto,
          separate: true,
          order: [['position', 'ASC']],
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const formattedPublications = publications.map(pub => ({
      ...pub.toJSON(),
      photo: pub.photo || null,
      photos: (pub.PublicationPhotos || []).map((p) => p.photo)
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

// === RÉCUPÉRER LES PUBLICATIONS DES MAGASINS SUIVIS PAR L'ACHETEUR CONNECTÉ ===
//
// Cette route n'existait pas du tout auparavant (ni la route, ni la
// fonction) : le frontend l'appelait deja (GET /publications/followed)
// mais recevait systematiquement une erreur 404.
exports.getFollowedPublications = async (req, res) => {
  try {
    const buyer = await Buyer.findOne({ where: { user_id: req.user.id } });
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Acheteur non trouvé'
      });
    }

    const follows = await Follow.findAll({ where: { buyer_id: buyer.id } });
    const storeIds = follows.map((f) => f.store_id);

    if (storeIds.length === 0) {
      return res.json({ success: true, publications: [] });
    }

    const publications = await Publication.findAll({
      where: {
        store_id: storeIds,
        is_active: true,
        is_draft: false
      },
      include: [
        {
          model: Store,
          include: [
            {
              model: Vendor,
              include: [{ model: User, attributes: ['id', 'name', 'avatar'] }],
            },
          ],
        },
        {
          model: PublicationPhoto,
          separate: true,
          order: [['position', 'ASC']],
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const formattedPublications = publications.map(pub => ({
      ...pub.toJSON(),
      photo: pub.photo || null,
      photos: (pub.PublicationPhotos || []).map((p) => p.photo)
    }));

    res.json({
      success: true,
      publications: formattedPublications
    });
  } catch (error) {
    console.error('Get followed publications error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des publications suivies'
    });
  }
};