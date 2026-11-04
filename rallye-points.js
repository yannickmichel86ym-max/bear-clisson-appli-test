'use strict';
// Points du rallye photo livrés avec l'application (fichier exporté par le mode organisateur, puis relu).
// Vide pour le moment. Chaque point doit être vérifié sur place : sécurité, accès, droit de photographier.
(function(root){
  const api={schemaVersion:1,points:[]};
  if(typeof module!=='undefined')module.exports=api;else root.BearRallyePoints=api;
})(typeof window==='undefined'?globalThis:window);
