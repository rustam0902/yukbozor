import Header from '../Header';

export default function HeaderExample() {
  return (
    <div className="space-y-4">
      <Header />
      <Header userRole={['customer']} />
    </div>
  );
}
