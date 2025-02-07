// src/App.js
import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  getDocs,
  deleteDoc
} from "firebase/firestore";
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  // ----- State Variables -----
  const [activeTab, setActiveTab] = useState("game");
  const [user, setUser] = useState(null);
  const [squaresData, setSquaresData] = useState({}); // keys: "row_col"
  const [configData, setConfigData] = useState({});    // holds axes, payouts, scores, etc.
  const [payouts, setPayouts] = useState({ Q1: "", Q2: "", Q3: "", Q4: "" });
  const [scores, setScores] = useState({
    Q1: { eagles: "", chiefs: "" },
    Q2: { eagles: "", chiefs: "" },
    Q3: { eagles: "", chiefs: "" },
    Q4: { eagles: "", chiefs: "" }
  });

  // ----- Constants & Logos -----
  const adminEmail = "jonathanferrari602@gmail.com";
  const eaglesLogo = process.env.PUBLIC_URL + "/eagles.png";
  const chiefsLogo = process.env.PUBLIC_URL + "/chiefs.png";

  // ----- Authentication -----
  const provider = new GoogleAuthProvider();
  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error during sign in:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error during sign out:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // ----- Real-time Listeners -----
  // Listen for square selections.
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "squares"), (snapshot) => {
      const squares = {};
      snapshot.forEach(docSnap => {
        squares[docSnap.id] = docSnap.data();
      });
      setSquaresData(squares);
    });
    return () => unsubscribe();
  }, []);

  // Listen for config document updates.
  useEffect(() => {
    const configRef = doc(db, "config", "game");
    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        setConfigData(docSnap.data());
      } else {
        setConfigData({});
      }
    });
    return () => unsubscribe();
  }, []);

  // ----- Utility Functions -----
  // Generate a random permutation of digits 0-9.
  const generateRandomAxis = () => {
    const digits = [...Array(10).keys()]; // [0,1,...,9]
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    return digits;
  };

  // Compute initials (first letter of first name and first letter of last name)
  const getInitials = (name) => {
    if (!name) return "";
    const parts = name.split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Determine a consistent color for a given user (up to 20 colors)
  const getColorForUser = (userId) => {
    // 20 distinct color codes:
    const colors = [
      "#007bff", "#28a745", "#dc3545", "#ffc107", "#17a2b8",
      "#6f42c1", "#fd7e14", "#20c997", "#343a40", "#e83e8c",
      "#6610f2", "#02b875", "#5c3d99", "#ffa500", "#bada55",
      "#ff1493", "#000000", "#a83232", "#00008b", "#808000"
    ];

    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // ----- Square Selection / Deselection -----
  // Prevent modifications once the game has started.
  const handleSquareClick = async (row, col) => {
    // If the axes exist, the game is started, so don't allow changes.
    if (configData.axes) {
      alert("The game has started; you can no longer select or deselect squares.");
      return;
    }

    const key = `${row}_${col}`;
    const square = squaresData[key];
    if (square) {
      // If the current user is the owner, allow deselection
      if (user && square.userId === user.uid) {
        try {
          await deleteDoc(doc(db, "squares", key));
        } catch (error) {
          console.error("Error deselecting square:", error);
        }
      } else {
        alert("This square has already been taken.");
      }
      return;
    }

    if (!user) {
      alert("Please sign in to select a square.");
      return;
    }

    // Otherwise, select the square.
    try {
      await setDoc(doc(db, "squares", key), {
        userId: user.uid,
        userName: user.displayName,
        row,
        col,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Error selecting square:", error);
    }
  };

  // ----- Admin Functions -----
  // "Start Game" sets (or resets) the axes for both teams, only if all squares are filled.
  const handleStartGame = async () => {
    const totalSquares = 100;
    const filledSquares = Object.keys(squaresData).length;

    // Require all squares to be filled before starting.
    if (filledSquares < totalSquares) {
      alert("All 100 squares must be filled before starting the game.");
      return;
    }

    try {
      const axes = {
        eagles: generateRandomAxis(),
        chiefs: generateRandomAxis()
      };
      await setDoc(doc(db, "config", "game"), {
        axes,
        payouts: configData.payouts || {},
        scores: configData.scores || {}
      }, { merge: true });
      alert("Game started with randomized axes!");
    } catch (error) {
      console.error("Error starting game:", error);
    }
  };

  // Save payout settings (validate total equals $100).
  const handleSavePayouts = async (e) => {
    e.preventDefault();
    const total = Number(payouts.Q1) + Number(payouts.Q2) + Number(payouts.Q3) + Number(payouts.Q4);
    if (total !== 100) {
      alert("Total payouts must equal $100.");
      return;
    }
    try {
      await setDoc(doc(db, "config", "game"), {
        payouts: {
          Q1: Number(payouts.Q1),
          Q2: Number(payouts.Q2),
          Q3: Number(payouts.Q3),
          Q4: Number(payouts.Q4)
        }
      }, { merge: true });
      alert("Payouts saved!");
    } catch (error) {
      console.error("Error saving payouts:", error);
    }
  };

  // Save quarter scores.
  const handleSaveScores = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, "config", "game"), {
        scores: {
          Q1: { eagles: scores.Q1.eagles, chiefs: scores.Q1.chiefs },
          Q2: { eagles: scores.Q2.eagles, chiefs: scores.Q2.chiefs },
          Q3: { eagles: scores.Q3.eagles, chiefs: scores.Q3.chiefs },
          Q4: { eagles: scores.Q4.eagles, chiefs: scores.Q4.chiefs }
        }
      }, { merge: true });
      alert("Scores saved!");
    } catch (error) {
      console.error("Error saving scores:", error);
    }
  };

  // Restart game: clear all squares and reset configuration.
  const handleRestartGame = async () => {
    if (!window.confirm("Are you sure you want to restart the game? This will clear all squares and game configuration.")) {
      return;
    }
    try {
      // Delete all documents in the "squares" collection.
      const squaresSnapshot = await getDocs(collection(db, "squares"));
      const deletePromises = [];
      squaresSnapshot.forEach((docSnap) => {
        deletePromises.push(deleteDoc(docSnap.ref));
      });
      await Promise.all(deletePromises);

      // Clear the config document.
      await setDoc(doc(db, "config", "game"), {}, { merge: false });
      alert("Game restarted!");
    } catch (error) {
      console.error("Error restarting game:", error);
    }
  };

  // ----- Compute Quarter Winner -----
  // For a given quarter, determine the winning square by matching last-digit of each team's score vs. the axes.
  const computeWinnerForQuarter = (quarter) => {
    if (!configData.axes || !configData.scores || !configData.scores[quarter]) return null;
    const scoreData = configData.scores[quarter];
    const eaglesScore = parseInt(scoreData.eagles);
    const chiefsScore = parseInt(scoreData.chiefs);
    if (isNaN(eaglesScore) || isNaN(chiefsScore)) return null;

    const eaglesLast = eaglesScore % 10;
    const chiefsLast = chiefsScore % 10;
    const col = configData.axes.eagles.indexOf(eaglesLast);
    const row = configData.axes.chiefs.indexOf(chiefsLast);
    if (col === -1 || row === -1) return null;

    const key = `${row}_${col}`;
    const square = squaresData[key];
    return { row, col, square };
  };

  // ----- Render Functions -----
  // Render the game grid.
  const renderGrid = () => {
    // If configData.axes doesn’t exist yet, show blank digits.
    const eaglesAxis = configData.axes ? configData.axes.eagles : Array(10).fill("");
    const chiefsAxis = configData.axes ? configData.axes.chiefs : Array(10).fill("");

    return (
      <div className="table-responsive">
      <table
        className="table table-bordered mx-auto"
        style={{ maxWidth: "100%", maxHeight: "80%", tableLayout: "fixed" }}
      >
        <thead>
          {/* Top row for Eagles label */}
          <tr>
            <th style={{ border: "none", borderWidth: 0, width: "60px" }} />
            <th style={{ border: "none", borderWidth: 0, width: "60px" }} />
            <th
              colSpan="10"
              className="no-border"
              style={{ borderLeft: "none", borderRight: "none" }}
            >
              <div
                className="text-center"
                style={{ fontSize: "1.5rem", fontWeight: "bold" }}
              >
                <div
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                    lineHeight: "2",
                    letterSpacing: "1em"
                  }}
                >
                  <img
                    src={eaglesLogo}
                    alt="Eagles"
                    style={{ width: "50px", marginRight: "20px" }}
                  />
                  EAGLES
                </div>
              </div>
            </th>
          </tr>
          {/* Row for Eagles digits */}
          <tr>
            <th
              className="no-border"
              style={{ border: "none", borderWidth: 0, width: "60px" }}
            />
            <th
              className="no-border"
              style={{ border: "none", borderWidth: 0, width: "60px" }}
            />
            {eaglesAxis.map((digit, idx) => (
              <th
                key={idx}
                className="text-center align-middle"
                style={{
                  backgroundColor: "#004C54",
                  color: "#A5ACAF",
                  fontSize: "1.2rem"
                }}
              >
                {digit}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chiefsAxis.map((chiefsDigit, rowIndex) => (
            <tr key={rowIndex}>
              {rowIndex === 0 && (
                <th
                  rowSpan="10"
                  className="no-border"
                  style={{
                    borderLeft: "none",
                    borderRight: "none",
                    verticalAlign: "top",
                    width: "60px",
                    paddingTop: "50px"
                  }}
                >
                  <div className="text-center">
                    <img
                      src={chiefsLogo}
                      alt="Chiefs"
                      style={{ width: "50px" }}
                    />
                    <div
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: "bold",
                        marginTop: "20px",
                        lineHeight: "2"
                      }}
                    >
                      C<br />
                      H<br />
                      I<br />
                      E<br />
                      F<br />
                      S
                    </div>
                  </div>
                </th>
              )}
              {/* Chiefs digit cell */}
              <th
                className="text-center align-middle"
                style={{
                  backgroundColor: "#D01F2F",
                  color: "#000000",
                  width: "60px",
                  fontSize: "1.2rem"
                }}
              >
                {chiefsDigit}
              </th>
              {/* 10 squares (cols) */}
              {Array.from({ length: 10 }).map((_, colIndex) => {
                const key = `${rowIndex}_${colIndex}`;
                const square = squaresData[key];
                return (
                  <td
                    key={colIndex}
                    onClick={() => handleSquareClick(rowIndex, colIndex)}
                    className="text-center align-middle"
                    style={{
                      cursor: square ? "default" : "pointer",
                      backgroundColor: square
                        ? getColorForUser(square.userId)
                        : "#f8f9fa",
                      color: square ? "#fff" : "#000",
                      fontWeight: "bold",
                      userSelect: "none",
                      minHeight: "50px",
                      maxHeight: "50px"
                    }}
                  >
                    {square ? getInitials(square.userName) : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    );
  };

  // Render the Players tab – tally squares claimed per user.
  const renderPlayersTab = () => {
    const playerCounts = {};
    Object.values(squaresData).forEach(square => {
      if (playerCounts[square.userId]) {
        playerCounts[square.userId].count += 1;
      } else {
        playerCounts[square.userId] = { name: square.userName, count: 1 };
      }
    });
    const players = Object.keys(playerCounts).map(userId => ({
      userId,
      name: playerCounts[userId].name,
      count: playerCounts[userId].count
    }));

    return (
      <div className="container">
        <h3>Players &amp; Squares Count</h3>
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Player</th>
              <th>Squares</th>
              <th>Amount Owed ($)</th>
            </tr>
          </thead>
          <tbody>
            {players.map(player => (
              <tr key={player.userId}>
                <td style={{ color: getColorForUser(player.userId) }}>
                  {getInitials(player.name)} - {player.name}
                </td>
                <td>{player.count}</td>
                {/* Assuming $1/square: */}
                <td>{player.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render the Results tab – display winners (if any) for each quarter.
  const renderResultsTab = () => {
    const quarters = ["Q1", "Q2", "Q3", "Q4"];
    return (
      <div className="container">
        <h3>Quarter Winners</h3>
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>Quarter</th>
              <th>Eagles Score</th>
              <th>Chiefs Score</th>
              <th>Winner</th>
              <th>Payout ($)</th>
            </tr>
          </thead>
          <tbody>
            {quarters.map(q => {
              const winnerData = computeWinnerForQuarter(q);
              const payout = configData.payouts ? configData.payouts[q] : "";
              return (
                <tr key={q}>
                  <td>{q}</td>
                  <td>{configData.scores && configData.scores[q] ? configData.scores[q].eagles : ""}</td>
                  <td>{configData.scores && configData.scores[q] ? configData.scores[q].chiefs : ""}</td>
                  <td>
                    {winnerData && winnerData.square ? (
                      <span style={{ color: getColorForUser(winnerData.square.userId) }}>
                        {getInitials(winnerData.square.userName)} - {winnerData.square.userName}
                      </span>
                    ) : "No square claimed"}
                  </td>
                  <td>{payout}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Render the Admin tab – only visible to the admin.
  const renderAdminTab = () => {
    return (
      <div className="container">
        <h3>Admin Panel</h3>
        {/* Initialize Game Section */}
        <div className="mb-4">
          <h5>Initialize Game Axes</h5>
          <button className="btn btn-primary me-2" onClick={handleStartGame}>Start Game</button>
          {configData.axes && (
            <span className="badge bg-success">Game Started</span>
          )}
        </div>

        {/* Set Payouts Section */}
        <div className="mb-4">
          <h5>Set Payouts (Total must equal $100)</h5>
          <form onSubmit={handleSavePayouts}>
            <div className="row">
              {["Q1", "Q2", "Q3", "Q4"].map((q) => (
                <div className="col" key={q}>
                  <label>{q}:</label>
                  <input
                    type="number"
                    className="form-control"
                    value={payouts[q]}
                    onChange={(e) => setPayouts({ ...payouts, [q]: e.target.value })}
                    required
                  />
                </div>
              ))}
            </div>
            <button type="submit" className="btn btn-secondary mt-2">Save Payouts</button>
          </form>
        </div>

        {/* Enter Scores Section */}
        <div className="mb-4">
          <h5>Enter Quarter Scores</h5>
          <form onSubmit={handleSaveScores}>
            {["Q1", "Q2", "Q3", "Q4"].map((q) => (
              <div className="row mb-2" key={q}>
                <div className="col">
                  <label>{q} Eagles:</label>
                  <input
                    type="number"
                    className="form-control"
                    value={scores[q].eagles}
                    onChange={(e) => setScores({ ...scores, [q]: { ...scores[q], eagles: e.target.value } })}
                    required
                  />
                </div>
                <div className="col">
                  <label>{q} Chiefs:</label>
                  <input
                    type="number"
                    className="form-control"
                    value={scores[q].chiefs}
                    onChange={(e) => setScores({ ...scores, [q]: { ...scores[q], chiefs: e.target.value } })}
                    required
                  />
                </div>
              </div>
            ))}
            <button type="submit" className="btn btn-secondary">Save Scores</button>
          </form>
        </div>

        {/* Restart Game Section */}
        <div className="mb-4">
          <h5>Restart Game</h5>
          <button className="btn btn-danger" onClick={handleRestartGame}>Restart Game</button>
        </div>
      </div>
    );
  };

  // Decide which tab to render.
  const renderTabContent = () => {
    switch (activeTab) {
      case "game":
        return <div className="text-center">{renderGrid()}</div>;
      case "players":
        return renderPlayersTab();
      case "results":
        return renderResultsTab();
      case "admin":
        return user && user.email === adminEmail ? renderAdminTab() : <div className="alert alert-danger">Access Denied</div>;
      default:
        return null;
    }
  };

  // ----- Main Render -----
  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>Super Bowl LIX Squares (Chiefs vs. Eagles)</h1>
        <div>
          {user ? (
            <>
              <span className="me-3">Signed in as {user.displayName}</span>
              <button className="btn btn-outline-secondary" onClick={handleSignOut}>Sign Out</button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={handleSignIn}>Sign in with Google</button>
          )}
        </div>
      </div>
      {/* Navigation Tabs */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "game" ? "active" : ""}`}
            onClick={() => setActiveTab("game")}
          >
            Game
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "players" ? "active" : ""}`}
            onClick={() => setActiveTab("players")}
          >
            Players
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "results" ? "active" : ""}`}
            onClick={() => setActiveTab("results")}
          >
            Results
          </button>
        </li>
        {user && user.email === adminEmail && (
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === "admin" ? "active" : ""}`}
              onClick={() => setActiveTab("admin")}
            >
              Admin
            </button>
          </li>
        )}
      </ul>
      {renderTabContent()}
    </div>
  );
}

export default App;
