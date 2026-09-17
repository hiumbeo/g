import { useState, FormEvent } from 'react';
import { Heart, Sparkles, Send, Flame } from 'lucide-react';

interface ShipResult {
  score: number;
  progressBar: string;
  comment: string;
  shipName: string;
}

interface GayResult {
  rate: number;
  progressBar: string;
  title: string;
  desc: string;
}

export default function FunTester() {
  const [tab, setTab] = useState<'ship' | 'gay'>('ship');

  // Ghép đôi state
  const [name1, setName1] = useState('');
  const [name2, setName2] = useState('');
  const [shipResult, setShipResult] = useState<ShipResult | null>(null);
  const [isShipping, setIsShipping] = useState(false);

  // Gayrate state
  const [gayName, setGayName] = useState('');
  const [gayResult, setGayResult] = useState<GayResult | null>(null);
  const [isGayTesting, setIsGayTesting] = useState(false);

  const handleShipSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name1.trim() || !name2.trim()) return;
    setIsShipping(true);
    try {
      const res = await fetch('/api/fun/ship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name1: name1.trim(), name2: name2.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setShipResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsShipping(false);
    }
  };

  const handleGaySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!gayName.trim()) return;
    setIsGayTesting(true);
    try {
      const res = await fetch('/api/fun/gay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: gayName.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setGayResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGayTesting(false);
    }
  };

  return (
    <div className="bg-[#1E1F22] rounded-xl border border-[#2B2D31] overflow-hidden mb-8 shadow-lg">
      <div className="bg-[#2B2D31]/60 p-4 border-b border-[#2B2D31] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              Khu Giải Trí Mini-Games & Thần Số Học
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                Mới
              </span>
            </h3>
            <p className="text-xs text-[#949BA4]">
              Mô phỏng trực tiếp kết quả của lệnh Discord <code className="text-pink-300">.ghepdoi</code> và <code className="text-pink-300">.gay</code>
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex items-center space-x-1 bg-[#111214] p-1 rounded-lg self-start sm:self-auto border border-[#2B2D31]">
          <button
            onClick={() => setTab('ship')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              tab === 'ship'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow'
                : 'text-[#949BA4] hover:text-white'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Ghép Đôi (.ghepdoi)</span>
          </button>
          <button
            onClick={() => setTab('gay')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              tab === 'gay'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow'
                : 'text-[#949BA4] hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Đo Độ Gay (.gay)</span>
          </button>
        </div>
      </div>

      <div className="p-5">
        {tab === 'ship' ? (
          <div>
            <form onSubmit={handleShipSubmit} className="grid grid-cols-1 sm:grid-cols-7 gap-3 mb-4">
              <input
                type="text"
                placeholder="Tên bạn / Người thứ nhất..."
                value={name1}
                onChange={(e) => setName1(e.target.value)}
                className="sm:col-span-3 px-3.5 py-2 bg-[#111214] border border-[#2B2D31] focus:border-pink-500 rounded-lg text-sm text-white placeholder-[#949BA4] outline-none"
              />
              <input
                type="text"
                placeholder="Tên crush / Người thứ hai..."
                value={name2}
                onChange={(e) => setName2(e.target.value)}
                className="sm:col-span-3 px-3.5 py-2 bg-[#111214] border border-[#2B2D31] focus:border-pink-500 rounded-lg text-sm text-white placeholder-[#949BA4] outline-none"
              />
              <button
                type="submit"
                disabled={isShipping || !name1.trim() || !name2.trim()}
                className="sm:col-span-1 flex items-center justify-center space-x-1 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Thử</span>
              </button>
            </form>

            {shipResult && (
              <div className="p-4 rounded-xl bg-pink-500/10 border border-pink-500/20 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-pink-500/20">
                  <span className="text-xs font-bold text-pink-400 uppercase tracking-wider">
                    💘 Kết Quả Ghép Đôi: <span className="text-white">{name1}</span> + <span className="text-white">{name2}</span>
                  </span>
                  <span className="text-sm font-black text-pink-400">
                    Tương thích: {shipResult.score}%
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
                  <div className="bg-[#111214] p-2.5 rounded-lg border border-[#2B2D31]">
                    <span className="text-[11px] text-[#949BA4] block">Biệt danh cặp đôi</span>
                    <span className="text-sm font-bold text-pink-300">{shipResult.shipName}</span>
                  </div>
                  <div className="bg-[#111214] p-2.5 rounded-lg border border-[#2B2D31] sm:col-span-2">
                    <span className="text-[11px] text-[#949BA4] block">Thước đo tình cảm</span>
                    <span className="text-sm tracking-widest">{shipResult.progressBar}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-300 italic bg-[#111214] p-2.5 rounded-lg border border-[#2B2D31]">
                  🔮 Lời sấm truyền: {shipResult.comment}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <form onSubmit={handleGaySubmit} className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="text"
                placeholder="Nhập tên thành viên cần đo độ gay lọ..."
                value={gayName}
                onChange={(e) => setGayName(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-[#111214] border border-[#2B2D31] focus:border-purple-500 rounded-lg text-sm text-white placeholder-[#949BA4] outline-none"
              />
              <button
                type="submit"
                disabled={isGayTesting || !gayName.trim()}
                className="flex items-center justify-center space-x-1 px-5 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Đo Ngay</span>
              </button>
            </form>

            {gayResult && (
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-purple-500/20">
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                    🌈 Phân Tích Quang Phổ: <span className="text-white">{gayName}</span>
                  </span>
                  <span className="text-sm font-black text-purple-400">
                    Chỉ số: {gayResult.rate}%
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
                  <div className="bg-[#111214] p-2.5 rounded-lg border border-[#2B2D31]">
                    <span className="text-[11px] text-[#949BA4] block">Danh hiệu phong tặng</span>
                    <span className="text-sm font-bold text-purple-300">{gayResult.title}</span>
                  </div>
                  <div className="bg-[#111214] p-2.5 rounded-lg border border-[#2B2D31] sm:col-span-2">
                    <span className="text-[11px] text-[#949BA4] block">Thang đo cầu vồng</span>
                    <span className="text-sm tracking-widest">{gayResult.progressBar}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-300 italic bg-[#111214] p-2.5 rounded-lg border border-[#2B2D31]">
                  💬 Nhận định: {gayResult.desc}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
