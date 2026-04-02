function RecentSearch({ recentHistory = [], setSelectedHistory, setRecentHistory }) {

  const clearHistory = () => {
    localStorage.removeItem("history");
    setRecentHistory([]);
  };

  return (
    <div className="col-span-1 bg-zinc-800 pt-3 h-screen overflow-hidden">
      
      <div className="flex justify-between items-center px-3">
        <h1 className="text-xl text-white">Recent History</h1>

        <button onClick={clearHistory} className="cursor-pointer">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="22px"
            viewBox="0 -960 960 960"
            width="22px"
            fill="#e3e3e3"
          >
            <path d="m376-300 104-104 104 104 56-56-104-104 104-104-56-56-104 104-104-104-56 56 104 104-104 104 56 56Z" />
          </svg>
        </button>
      </div>

      <ul className="text-left overflow-auto mt-3 h-[90%]">
        {recentHistory.length > 0 ? (
          recentHistory.map((item, index) => (
            <li
              key={index}
              onClick={() => setSelectedHistory(item)}
              className="p-2 px-5 truncate text-zinc-400 cursor-pointer hover:bg-zinc-700 hover:text-zinc-200 transition"
            >
              {item}
            </li>
          ))
        ) : (
          <p className="text-zinc-500 text-sm px-5 mt-3">
            No recent searches
          </p>
        )}
      </ul>
    </div>
  );
}

export default RecentSearch;
