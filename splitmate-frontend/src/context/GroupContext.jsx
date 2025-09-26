// context/GroupContext.js
import { createContext, useContext, useEffect, useState } from "react";
import {getAllGroups} from "../api/groups"

const GroupContext = createContext();

export const useGroups = () => useContext(GroupContext);

export const GroupProvider = ({ children }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load all groups of logged-in user
  const loadGroups = async () => {
    try {
      setLoading(true);
      const data= await getAllGroups()
      setGroups(data.groups || []); // comes with members populated
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  return (
    <GroupContext.Provider
      value={{
        groups,
        loading,
        error,
        reloadGroups: loadGroups, // handy if you add new group
      }}
    >
      {children}
    </GroupContext.Provider>
  );
};
