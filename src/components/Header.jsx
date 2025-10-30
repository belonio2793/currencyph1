export default function Header() {
  return (
    <div className="mb-12 border-b pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-bold text-black mb-2">💱 Currency Exchange</h1>
          <p className="text-gray-600">Real-time global currency & cryptocurrency rates</p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p>Powered by global financial networks</p>
          <p>Live market data • Zero commission</p>
        </div>
      </div>
    </div>
  )
}
