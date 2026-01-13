const recent_trucks = [
    {
      "id": 20,
      "entrepotId": 8,
      "immatriculation": "23",
      "transporteur": "jiles",
      "statut": "A venir",
      "metadata": "{\"clientType\":\"Magasin\",\"booking\":\"23\",\"conteneurs\":1,\"volume\":0.5,\"dateStart\":\"2026-01-30T07:16\",\"dateEnd\":\"2026-01-31T07:16\"}"
    }
];

function mapTruckToEmpotage(row) {
  let meta = {};
  try { if (row.metadata) meta = JSON.parse(row.metadata); } catch (e) {}

  return {
    id: row.id,
    client: row.transporteur || meta.client || 'Inconnu',
    clientType: meta.clientType || row.cooperative || 'N/A',
    booking: meta.booking || (meta.bookingId || row.immatriculation || ''),
    conteneurs: meta.conteneurs || meta.nbConteneurs || 0,
    volume: meta.volume || row.poids || 0,
    dateStart: meta.dateStart || (row.heureArrivee ? new Date(row.heureArrivee).toLocaleString() : ''),
    dateEnd: meta.dateEnd || (row.heureDepart ? new Date(row.heureDepart).toLocaleString() : ''),
    status: row.statut || meta.status || 'Enregistré',
    raw: { ...row, ...meta }
  };
}

const mapped = recent_trucks.map(mapTruckToEmpotage);
console.log(JSON.stringify(mapped, null, 2));
