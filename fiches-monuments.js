'use strict';
/*
 * Fiches monuments V13 — rédigées par Claude Code le 04/11/2026 d'après Wikipédia (CC BY-SA 4.0).
 * Statut : BROUILLON À RELIRE par Yannick / ChatGPT avant toute diffusion.
 * Règle : chaque phrase reprend uniquement ce qu'affirme la page citée. Le champ « appuis » contient des
 * extraits EXACTS de la copie locale (sources/wikipedia/*.txt), contrôlés par les tests.
 * Aucune fiche n'invente de date ni de fait : sans source suffisante, fiche = null (« en préparation »).
 */
(function(root){
  const W='https://fr.wikipedia.org/wiki/';
  const src={
    chateau:{titre:'Château de Clisson',url:W+'Ch%C3%A2teau_de_Clisson',revision:228739390,fichier:'sources/wikipedia/Château_de_Clisson.txt'},
    notreDame:{titre:'Église Notre-Dame de Clisson',url:W+'%C3%89glise_Notre-Dame_de_Clisson',revision:232747740,fichier:'sources/wikipedia/Église_Notre-Dame_de_Clisson.txt'},
    halles:{titre:'Halles de Clisson',url:W+'Halles_de_Clisson',revision:235103857,fichier:'sources/wikipedia/Halles_de_Clisson.txt'},
    stJacques:{titre:'Église Saint-Jacques de Clisson',url:W+'%C3%89glise_Saint-Jacques_de_Clisson',revision:240277746,fichier:'sources/wikipedia/Église_Saint-Jacques_de_Clisson.txt'},
    trinite:{titre:'Église de la Trinité de Clisson',url:W+'%C3%89glise_de_la_Trinit%C3%A9_de_Clisson',revision:225504780,fichier:'sources/wikipedia/Église_de_la_Trinité_de_Clisson.txt'},
    pont:{titre:'Pont de la Vallée (Clisson)',url:W+'Pont_de_la_Vall%C3%A9e_(Clisson)',revision:231671422,fichier:'sources/wikipedia/Pont_de_la_Vallée__Clisson_.txt'},
    garenne:{titre:'Domaine de la Garenne Lemot',url:W+'Domaine_de_la_Garenne_Lemot',revision:239812041,fichier:'sources/wikipedia/Domaine_de_la_Garenne_Lemot.txt'},
    clisson:{titre:'Clisson',url:W+'Clisson',revision:240767091,fichier:'sources/wikipedia/Clisson.txt'}
  };
  const fiches={
    w113825057:{resume:'Forteresse des seigneurs de Clisson, bâtie du XIe au XVe siècle sur un promontoire de granite qui domine la Sèvre nantaise. Elle gardait la frontière du duché de Bretagne. Incendiée pendant la guerre de Vendée, longtemps en ruines, elle a été restaurée à partir de 1974.',
      fait:{date:'1380',texte:'Olivier V de Clisson, né dans ce château, devient connétable de France.'},
      source:src.chateau,appuis:['du XIe jusqu\'au XVe siècle','dominant la rive gauche de la Sèvre nantaise','incendié par les troupes républicaines pendant la guerre de Vendée','restauré de 1974 à 1975','devenu connétable en 1380','dans lequel il est né']},
    w79287479:{resume:'Ancienne collégiale fondée par Olivier V de Clisson. L’église actuelle, au style italien, a été reconstruite en 1887-1888 par l’architecte nantais René Ménard.',
      fait:{date:'1793-1794',texte:'Pendant la guerre de Vendée, le feu détruit l’ancienne collégiale du XIVe siècle. Elle est reconstruite en 1887-1888.'},
      source:src.notreDame,appuis:['fondée par Olivier V de Clisson','reconstruite en 1887-1888, par l\'architecte nantais René Ménard','détruite par le feu durant la guerre de Vendée','Presque entièrement rasée en 1886']},
    w79281016:{resume:'Halles à charpente de chêne, de châtaignier et de sapin, sur près de 900 m². Ce sont l’une des cinq dernières halles à charpente de bois de la Bretagne historique, et le marché s’y tient toujours.',
      fait:{date:'1793',texte:'Pendant les guerres de Vendée, les Halles font partie des rares édifices épargnés : les Républicains éteignent eux-mêmes le feu qui les gagnait. Leurs bois les plus anciens datent de 1376-1377.'},
      source:src.halles,appuis:['chêne, châtaignier et sapin','environ 900 m2','il ne subsiste en Bretagne historique plus que cinq halles à charpente de bois','Les Républicains eux-mêmes éteignirent le feu qui se propageait sur les Halles','autour de 1376-1377','abritent toujours les marchés de Clisson']},
    w79287435:{resume:'Église romane du XIIe siècle, ancien prieuré bénédictin et étape des pèlerins de Saint-Jacques-de-Compostelle sur la route Nantes – Parthenay. Propriété de la ville, elle abrite un espace culturel.',
      fait:{date:'29 mai 1789',texte:'Le Tiers-État s’y réunit pour rédiger le cahier de doléances des paroisses de Clisson, avec 119 Clissonnais.'},
      source:src.stJacques,appuis:['servait d\'étape pour les pèlerins de Saint Jacques de Compostelle','Nantes - Parthenay','édifiée au du XIIe siècle','sert de lieu de réunion du Tiers-Etat pour rédiger les cahiers de doléance','119 Clissonais','Il abrite un espace culturel']},
    w79283232:{resume:'Sans doute la plus ancienne église de la ville, mentionnée dès 855. L’église romane, bâtie en 1105 pour un prieuré bénédictin, a été très remaniée au fil des siècles.',
      fait:{date:'1794',texte:'L’église est incendiée lors du passage des Colonnes infernales, puis remise en état et lourdement restaurée en 1869.'},
      source:src.trinite,appuis:['il en est fait mention dès 855','l\'église bâtie en 1105','incendiée en 1794, lors du passage des Colonnes Infernales','lourdement restaurée en 1869']},
    w323967795:{resume:'Pont de pierre à six arches inégales qui franchit la Sèvre nantaise entre la ville et le faubourg de la Trinité.',
      fait:{date:'XIXe siècle',texte:'Le pont avait des passerelles de bois à ses extrémités. Au XIXe siècle, elles ont été remplacées par des voûtes en pierre.'},
      faitSource:{titre:'Mairie de Clisson, patrimoine : pont de la Vallée',url:'https://www.mairie-clisson.fr/fileadmin/Clisson/Telechargements/01_Ville_de_Clisson/Patrimoine/pont-vallee_01.pdf'},
      source:src.pont,appuis:['six arches d\'ouvertures inégales','son faubourg de la Trinité','classement au titre des monuments historiques depuis le 20 mars 1922','Les piles existaient au XVIIIe siècle','construit en bois','ne remonte donc pas avant la fin du XVIIIe siècle']},
    n1833991148:{resume:'Ancienne porte de ville de Clisson, classée monument historique le 21 décembre 1984.',
      fait:null,source:src.clisson,appuis:['L\'ancienne porte de ville, classée au titre des Monuments historiques par arrêté du 21 décembre 1984']},
    n9419536646:{resume:'Les Cordeliers sont des religieux franciscains. Leur ordre naît en Italie en 1209, sous l’impulsion de saint François d’Assise. Leur nom vient de la corde qui ceint leur robe. Ils vivent de pauvreté, du travail de leurs mains et de l’aumône, et prêchent. Le couvent de Clisson est fondé au début du XVe siècle.',
      fait:null,source:src.clisson,appuis:['Le couvent des Cordeliers, fondé par les cordeliers, au début du XVe siècle']},
    w143995195:{resume:'Villa néo-palladienne qui surplombe la vallée de la Sèvre : c’est le cœur du domaine imaginé par le sculpteur François-Frédéric Lemot pour rappeler l’Italie.',
      fait:{date:'1824',texte:'Début du chantier par l’architecte Pierre-Louis van Cleemputte. Lemot n’en voit jamais la fin ; son fils Barthélemy achève la villa.'},
      source:src.garenne,appuis:['villa néo-palladienne surplombant la vallée de la Sèvre nantaise','les travaux ne commencent qu\'en 1824','François-Frédéric Lemot n\'en voit jamais la fin','Il achève l\'aménagement de villa']},
    w79287736:{resume:'Domaine de style italien. Le négociant Jacques-Charles Valentin, ami de Lemot, s’installe dans l’ancien couvent des Bénédictines de la Trinité et l’agrandit entre 1810 et 1817.',
      fait:null,source:src.garenne,appuis:['Le négociant Jacques-Charles Valentin, amis de Lemot, installe sa résidence dans l\'ancien couvent des Bénédictines de la Trinité','entre 1810 et 1817']},
    w165256181:{resume:'Parc de 13 hectares créé au début du XIXe siècle par le sculpteur François-Frédéric Lemot, en hommage aux paysages et à l’architecture de l’Italie.',
      fait:{date:'26 juin 1805',texte:'Lemot achète la Garenne, ancienne réserve de chasse des seigneurs de Clisson, et l’aménage jusqu’à sa mort en 1827.'},
      source:src.garenne,appuis:['créé par le sculpteur François-Frédéric Lemot au début du XIXe siècle','hommage aux paysages et à l\'architecture de l\'Italie','La surface totale du domaine est de 13 hectares','une réserve de chasse appartenant aux seigneurs de Clisson','acquiert cette propriété de la Garenne dès le 26 juin 1805','Il l\'aménage sans interruption jusqu\'à sa mort en 1827']},
    n5486833906:{resume:'Une colonne élevée par Lemot face à sa Garenne, couronnée d’un buste d’Henri IV. Elle rappelle la tentative échouée du futur roi de prendre le château de Clisson en 1588.',
      fait:null,source:src.garenne,appuis:['la statue de Henri IV','auxquels s\'ajoutent la colonne d\'Henri IV et le parc qui l\'entoure en 1986']},
    w165256184:{resume:'Une glacière : un puits de pierre où l’on conservait la glace de l’hiver pour la garder jusqu’à l’été. Barthélemy Lemot la fait construire après son installation à Clisson en 1841.',
      fait:null,source:src.garenne,appuis:['se trouve l\'ancienne glacière du parc','décide de s\'installer à Clisson en 1841','la colonnade en pierre fermant la cour et la glacière']},
    w79287855:{resume:'Théâtre construit en 1905 par Marguerite-Antoinette Lemot, qui le nomme « le Tivoli ». Acheté par la commune en 1934, il devient un cinéma en 1948. Fermé pour raisons de sécurité en 1993, il est gravement endommagé par un incendie en 2008.',
      fait:{date:'1905',texte:'Marguerite-Antoinette Lemot, petite-fille du sculpteur, fait construire la salle de spectacle et la nomme « le Tivoli », comme la ville italienne que Lemot voulait évoquer dans sa Garenne.'},
      faitSource:{titre:'Mairie de Clisson (dossier 2017) ; Wikipédia, Domaine de la Garenne Lemot',url:'https://fr.wikipedia.org/wiki/Domaine_de_la_Garenne_Lemot'},
      source:{titre:'Le Tivoli, dossier de Nicole Petit (2017), Mairie de Clisson',url:'https://www.mairie-clisson.fr/fileadmin/Clisson/Telechargements/01_Ville_de_Clisson/Patrimoine/texte-tivoli.pdf',revision:'2017',fichier:'sources/mairie/tivoli-dossier-2017.txt'},
      appuis:['qui fit construire le théâtre du Tivoli','Elle nomme cette salle de théâtre','Le Tivoli prend alors le nom de','Pour des raisons de sécurité, le Tivoli est définitivement fermé']},
    n14062722890:{resume:'Un moulin de la vallée de la Sèvre, avec sa chaussée de pierre qui permet de passer à pied quand la rivière le permet. Le dernier meunier, Gabriel Neau, faisait visiter le moulin.',
      fait:{date:'1393',texte:'Première mention des moulins de Gervaux, qui dépendent alors du domaine de la Barillère.'},
      source:{titre:'Moulin de Gervaux, fiche patrimoine, Mairie de Clisson',url:'https://www.mairie-clisson.fr/fileadmin/Clisson/Telechargements/01_Ville_de_Clisson/Patrimoine/moulin-gervaux.pdf',revision:'2020',fichier:'sources/mairie/moulin-gervaux.txt'},
      appuis:['Première mention des moulins de Gervaux : 1393','M. Gabriel Neau, dernier meunier à Gervaux','une visite commentée du moulin']},
    // Sources insuffisantes à ce jour : aucune fiche plutôt qu'un texte inventé.
    w79288179:{resume:'Le siège de la mairie de Clisson, au 3, grande rue de la Trinité.',fait:null,source:{titre:'Clisson, Wikipédia',url:'https://fr.wikipedia.org/wiki/Clisson',revision:'240767091',fichier:'sources/wikipedia/Clisson.txt'},appuis:['L\'hôtel de ville de Clisson se situe au 3, grande rue de la Trinité']}
  };
  const api={sources:src,fiches,statut:'brouillon à relire',licence:'Textes rédigés d’après Wikipédia, CC BY-SA 4.0'};
  if(typeof module!=='undefined')module.exports=api;else root.BearFiches=api;
})(typeof window==='undefined'?globalThis:window);
