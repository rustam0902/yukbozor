import OfferCard from '../OfferCard';

export default function OfferCardExample() {
  return (
    <div className="max-w-3xl space-y-4 p-4">
      <OfferCard
        id="1"
        carrierName="ООО Быстрая Доставка"
        carrierRating={4.8}
        price={4800000}
        status="active"
        createdAt="2024-01-20 14:30"
        onAccept={() => console.log('Accept clicked')}
        onReject={() => console.log('Reject clicked')}
      />
      <OfferCard
        id="2"
        carrierName="Логистик Транс"
        carrierRating={4.5}
        price={5200000}
        status="accepted"
        createdAt="2024-01-20 15:15"
      />
    </div>
  );
}
