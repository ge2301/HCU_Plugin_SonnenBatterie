// Simple textual energy-flow summary describing where power is currently flowing.
export default function EnergyFlow({ status }) {
  const flows = [];
  const { productionW, consumptionW, gridImportPowerW, batteryChargePowerW } = status;

  if (productionW > 5) flows.push(`PV erzeugt ${Math.round(productionW)} W`);
  if (batteryChargePowerW > 5) flows.push(`Batterie lädt mit ${Math.round(batteryChargePowerW)} W`);
  if (batteryChargePowerW < -5) flows.push(`Batterie liefert ${Math.round(-batteryChargePowerW)} W`);
  if (gridImportPowerW > 5) flows.push(`Bezug aus dem Netz ${Math.round(gridImportPowerW)} W`);
  if (gridImportPowerW < -5) flows.push(`Einspeisung ins Netz ${Math.round(-gridImportPowerW)} W`);
  if (consumptionW > 5) flows.push(`Haus verbraucht ${Math.round(consumptionW)} W`);

  return (
    <section className="flow">
      <h2>Energiefluss</h2>
      {flows.length ? (
        <ul>
          {flows.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      ) : (
        <p className="muted-text">Keine nennenswerten Energieflüsse.</p>
      )}
    </section>
  );
}
