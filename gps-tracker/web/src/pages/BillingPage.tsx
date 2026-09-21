import { useSubscription } from '../lib/useSubscription';

const statusLabel: Record<string, { text: string; color: string }> = {
  trialing: { text: 'Periodo de prueba', color: 'text-blue-600' },
  active: { text: 'Activa', color: 'text-green-600' },
  past_due: { text: 'Pago pendiente', color: 'text-amber-600' },
  expired: { text: 'Vencida', color: 'text-red-600' },
  canceled: { text: 'Cancelada', color: 'text-gray-500' },
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(cents / 100);
}

export function BillingPage() {
  const { subscription, payments, loading, simulatePayment } = useSubscription();

  if (loading) return <p className="p-6 text-sm text-gray-500">Cargando...</p>;
  if (!subscription) return <p className="p-6 text-sm text-gray-500">No se encontró suscripción.</p>;

  const plan = subscription.plans;
  const status = statusLabel[subscription.status] ?? { text: subscription.status, color: 'text-gray-500' };
  const periodEnd = new Date(subscription.current_period_end);
  const daysLeft = Math.ceil((periodEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-lg font-bold">Facturación</h1>

      <div className="border rounded-xl p-4 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Plan actual</p>
            <p className="font-semibold text-lg">{plan?.name ?? '—'}</p>
            <p className="text-sm text-gray-500">
              {plan ? `${formatMoney(plan.price_cents, plan.currency)} / mes · hasta ${plan.max_vehicles} vehículos` : ''}
            </p>
          </div>
          <span className={`font-medium ${status.color}`}>{status.text}</span>
        </div>

        <p className="text-sm text-gray-500 mt-3">
          {daysLeft >= 0
            ? `Vence en ${daysLeft} día(s), el ${periodEnd.toLocaleDateString()}.`
            : `Venció hace ${Math.abs(daysLeft)} día(s).`}
        </p>

        <p className="text-xs text-gray-400 mt-2">
          Nota: todavía no hay pasarela de pago real conectada. Este botón simula el cobro mensual —
          el día que se conecte Stripe, un webhook llamará la misma función <code>record_payment</code>{' '}
          automáticamente en vez de un click.
        </p>

        <button
          onClick={() => plan && simulatePayment(plan.price_cents)}
          className="mt-4 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium"
        >
          Simular pago de este mes
        </button>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Historial de pagos</h2>
        <div className="border rounded-xl bg-white divide-y">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>{new Date(p.paid_at).toLocaleString()}</span>
              <span>{formatMoney(p.amount_cents, p.currency)}</span>
              <span className="text-gray-500">{p.method}</span>
            </div>
          ))}
          {payments.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">Sin pagos aún.</p>}
        </div>
      </div>
    </div>
  );
}
