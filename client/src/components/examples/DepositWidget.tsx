import DepositWidget from '../DepositWidget';

export default function DepositWidgetExample() {
  return (
    <div className="max-w-md p-4">
      <DepositWidget
        balance={10000000}
        blocked={2000000}
        onTopUp={() => console.log('Top up clicked')}
      />
    </div>
  );
}
