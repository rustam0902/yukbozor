import OrderCard from '../OrderCard';

export default function OrderCardExample() {
  return (
    <div className="max-w-2xl space-y-4 p-4">
      <OrderCard
        id="1"
        title="Перевозка строительных материалов"
        originRegion="Ташкентская область"
        originDistrict="Чирчикский район"
        destinationRegion="Самаркандская область"
        destinationDistrict="Самарканд"
        transportType="Фура 20т"
        weight={18}
        loadDate="2024-01-25"
        price={5000000}
        status="new"
        isDangerous={false}
        isNonstandard={true}
        onSubmitOffer={() => console.log('Submit offer clicked')}
      />
    </div>
  );
}
