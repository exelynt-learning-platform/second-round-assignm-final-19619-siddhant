function RecentSearch({ recentHistory, setSelectedHistory, setRecentHistory }) {

  const clearHistory = () => {
    localStorage.clear();
    setRecentHistory([]);
  };

  return (
    <div className="col-span-1 bg-zinc-800 pt-3">
      <h1 className="text-xl text-white flex justify-center">
        <span>Recent History</span>
        <button onClick={clearHistory} className="cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3">
            <path d="m376-300 104-104 104 104 56-56-104-104 104-104-56-56-104 104-104-104-56 56 104 104-104 104 56 56Z" />
          </svg>
        </button>
      </h1>

      <ul className="text-left overflow-auto mt-2">
        {recentHistory.map((item, index) => (
          <li
            key={index}
            onClick={() => setSelectedHistory(item)}
            className="p-1 pl-5 px-5 truncate text-zinc-400 cursor-pointer hover:bg-zinc-700 hover:text-zinc-200"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default RecentSearch;