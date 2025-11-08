import { useState, useEffect, useContext, useRef } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import styles from "../styles/sidebar.module.css";
import { Users, Trash2, LayoutDashboard, History, Receipt } from "lucide-react";
import { getAllGroups, deleteGroup } from "../api/groups";
import { getAllFriends, deleteFriend } from "../api/friends";
import AddGroupModal from "../components/AddGroupModal";

import { sendInvite } from "../api/invite";
import { AuthContext } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { toast } from "react-hot-toast";
const Sidebar = ({ open, setOpen }) => {
  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [email, setEmail] = useState("");
  const navigate = useNavigate();
  const { user: currentUser } = useContext(AuthContext);
  const { socket } = useSocket();
  const location = useLocation();
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, group: null });
  const [deleteFriendConfirm, setDeleteFriendConfirm] = useState({ show: false, friend: null });
  const [isDeleting, setIsDeleting] = useState(false); // ✅ Add loading state
  const [isSendingInvite, setIsSendingInvite] = useState(false); // ✅ Add loading state
  const sidebarRef = useRef(null);



  const fetchGroups = async () => {
    try {
      const data = await getAllGroups();
      setGroups(data.groups || []);
    } catch (err) {
      console.error("Error fetching groups:", err);
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchFriends = async () => {
    try {
      const data = await getAllFriends();
      const filtered = data.filter((f) => f._id !== currentUser._id);
      setFriends(filtered);
    } catch (err) {
      console.error("Error fetching friends:", err);
    } finally {
      setLoadingFriends(false);
    }
  };
  useEffect(() => {
    if (typeof window === "undefined") return;  // ✅ SSR safe
    fetchGroups();
    fetchFriends();
  }, []);

  // Close sidebar on route change for small screens
  useEffect(() => {
    if (typeof window === "undefined") return;  // ✅ SSR safe
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Close on ESC key when open on mobile
  useEffect(() => {
    if (typeof window === "undefined") return;  // ✅ SSR safe
    const onKey = (e) => {
      if (e.key === 'Escape') {
        const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
        if (isMobile) setOpen(false);
      }
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  // Prevent background scroll when sidebar is open on mobile
  useEffect(() => {
    if (typeof window === "undefined") return;  // ✅ SSR safe
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile) return; // Only apply off-canvas scroll lock on small screens

    let previousScrollY = 0;
    const preventTouchMove = (e) => {
      // Allow scrolling inside the sidebar itself
      if (sidebarRef.current && sidebarRef.current.contains(e.target)) return;
      // Block touch scrolling on the page behind
      e.preventDefault();
    };

    if (open) {
      // Capture current scroll position and lock body
      previousScrollY = window.scrollY || window.pageYOffset;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${previousScrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      // On iOS/Safari, also intercept touchmove outside sidebar
      document.addEventListener('touchmove', preventTouchMove, { passive: false });
    } else {
      // Restore scroll
      const top = parseInt(document.body.style.top || '0', 10) || 0;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      window.scrollTo(0, -top);
      document.removeEventListener('touchmove', preventTouchMove);
    }

    return () => {
      document.removeEventListener('touchmove', preventTouchMove);
      // Safety: ensure cleanup if component unmounts while open
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [open]);

  // Socket listeners for real-time updates
  useEffect(() => {
    if (typeof window === "undefined") return;  // ✅ SSR safe
    if (!socket) return;

    const handleGroupUpdate = () => {
      fetchGroups(); // Refresh groups list
    };

    // Listen for group creation, deletion, and updates
    socket.on('group_created', handleGroupUpdate);
    socket.on('group_deleted', handleGroupUpdate);
    socket.on('group_member_joined', handleGroupUpdate);

    const handleFriendsUpdate = () => {
      fetchFriends();
    };
    socket.on('friends_updated', handleFriendsUpdate);

    return () => {
      socket.off('group_created', handleGroupUpdate);
      socket.off('group_deleted', handleGroupUpdate);
      socket.off('group_member_joined', handleGroupUpdate);
      socket.off('friends_updated', handleFriendsUpdate);
    };
  }, [socket]);

  // Invite Handlers
  const handleSendInvite = async () => {
    if (isSendingInvite) return;
    
    try {
      if (!email) {
        toast.error("Please enter an email");
        return;
      }
      setIsSendingInvite(true);
      await sendInvite({ email, groupId: null });
      toast.success("Invite sent!");
      setEmail("");
      await fetchFriends();
    } catch (err) {
      console.error(err);
      toast.error("Failed to send invite");
    } finally {
      setIsSendingInvite(false);
    }
  };


  const handleAddGroup = async (groupDetails) => {
    try {
      // Don't create the group here - AddGroupModal already does that
      // Just handle UI updates after successful creation
      setShowAddGroup(false);
      fetchGroups();
    } catch (err) {
      console.error("Error handling group creation:", err);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    try {
      await deleteGroup(groupId);
      fetchGroups();
      setDeleteConfirm({ show: false, group: null });
      if (window.location.pathname.includes(`/groups/${groupId}`)) {
        navigate('/dashboard');
      }
      toast.success("Group deleted");
    } catch (err) {
      console.error("Error deleting group:", err);
      toast.error(err.message || "Failed to delete group");
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <>
  {/* Sidebar */}
  <aside ref={sidebarRef} className={`${styles.sidebar} ${open ? styles.show : ""}`}>
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.activeLink : ""}`}
          onClick={() => setOpen(false)}
          end
        >
          <LayoutDashboard size={18} className={styles.navIcon} />
          <span>DASHBOARD</span>
        </NavLink>
        <NavLink
          to="/recent"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.activeLink : ""}`}
          onClick={() => setOpen(false)}
        >
          <History size={18} className={styles.navIcon} />
          <span>RECENT ACTIVITY</span>
        </NavLink>
        <NavLink
          to="/expenses"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.activeLink : ""}`}
          onClick={() => setOpen(false)}
        >
          <Receipt size={18} className={styles.navIcon} />
          <span>ALL EXPENSES</span>
        </NavLink>

        {/* Groups Section */}
        <div className={styles.groupSection}>
          <div className={styles.groupHeader}>
            <h4 className={styles.sectionTitle}>Groups</h4>
            <button
              className={styles.addGroupBtn}
              onClick={() => setShowAddGroup(true)}
            >
              + Add
            </button>
          </div>


          {loadingGroups ? (
            <p className={styles.loading}>Loading...</p>
          ) : groups.length === 0 ? (
            <p className={styles.empty}>No groups yet</p>
          ) : (
            groups.map((g) => {
              const isCreator = String(g.createdBy) === String(currentUser?._id);
              const memberCount = Array.isArray(g.members)
                ? new Set(g.members.map(m => m._id)).size
                : 0;
              return (
                <div key={g._id} className={`${styles.groupItem} ${location.pathname.includes(`/groups/${g._id}`) ? styles.activeGroup : ""}`}>
                  <div
                    className={styles.groupContent}
                    onClick={() => {
                      navigate(`/groups/${g._id}`);
                      setOpen(false);
                    }}
                  >
                    <span className={styles.iconWrap}>
                      <Users size={18} className={styles.groupIcon} />
                      <span className={styles.badge}>{memberCount}</span>
                    </span>
                    <span>{g.name}</span>
                  </div>
                  {isCreator && (
                    <button
                    className={styles.deleteBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm({ show: true, group: g });
                    }}
                    title="Delete group (you are the creator)"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>


        {/* Friends Section */}
        <div className={styles.groupSection}>
          <div className={styles.groupHeader}>
            <h4 className={styles.sectionTitle}>Friends</h4>
          </div>
          {loadingFriends ? (
            <p className={styles.loading}>Loading...</p>
          ) : friends.length === 0 ? (
            <p className={styles.empty}>No friends yet</p>
          ) : (
            friends.map((f) => {
              const isActiveFriend = location.pathname.includes(`/friends/${f._id}`);
              return (
              <div key={f._id} className={`${styles.groupItem} ${styles.friendItem} ${isActiveFriend ? styles.activeGroup : ""}`}>
                <div className={styles.groupTopRow}>
                  <div
                    className={styles.groupContent}
                    onClick={() => {
                      navigate(`/friends/${f._id}`);
                      setOpen(false);
                    }}
                  >
                    <Users size={18} className={styles.groupIcon} />
                    <div className={styles.friendName}>{f.name}</div>
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteFriendConfirm({ show: true, friend: f });
                    }}
                    title="Remove friend"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className={styles.friendEmail}>
                  {/* ({f.email}) */}
                </div>
              </div>
            )})
          )}
        </div>

        {/* Invite Section */}
        <div className={styles.groupSection}>
          <div className={styles.groupHeader}>
            <h4 className={styles.sectionTitle}>Invite Friends</h4>
          </div>
          <input
            type="email"
            placeholder="Enter an email address"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendInvite();
              }
            }}
            disabled={isSendingInvite}
          />
          <button 
            className={styles.btn} 
            onClick={handleSendInvite}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSendInvite();
              }
            }}
            disabled={isSendingInvite}
            style={{ opacity: isSendingInvite ? 0.6 : 1, cursor: isSendingInvite ? 'not-allowed' : 'pointer' }}
          >
            {isSendingInvite ? "Sending..." : "Send Invite"}
          </button>


        </div>
      </aside>
      {/* Backdrop for mobile: close when clicking outside */}
      <div
        className={`${styles.backdrop} ${open ? styles.backdropShow : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      {showAddGroup && (
        <AddGroupModal
          isOpen={showAddGroup}
          onClose={() => setShowAddGroup(false)}
          onGroupAdded={handleAddGroup}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.show && (
        <div className={styles.deleteModal}>
          <div className={styles.deleteDialog}>
            <p>
              Are you sure you want to DELETE <strong>"{deleteConfirm.group?.name}"</strong>?
            </p>
            <p className={styles.warning}>
              ⚠️ This will permanently delete the group.
            </p>
            <div className={styles.deleteActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setDeleteConfirm({ show: false, group: null })}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className={styles.confirmDeleteBtn}
                onClick={() => handleDeleteGroup(deleteConfirm.group._id)}
                disabled={isDeleting}
                style={{ opacity: isDeleting ? 0.6 : 1, cursor: isDeleting ? 'not-allowed' : 'pointer' }}
              >
                {isDeleting ? "Deleting..." : "Delete Group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteFriendConfirm.show && (
        <div className={styles.deleteModal}>
          <div className={styles.deleteDialog}>
            <h3>Remove Friend</h3>
            <p>
              Are you sure you want to remove <strong>{deleteFriendConfirm.friend?.name}</strong> from your friends?
            </p>
            <div className={styles.deleteActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setDeleteFriendConfirm({ show: false, friend: null })}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className={styles.confirmDeleteBtn}
                onClick={async () => {
                  if (isDeleting) return;
                  
                  setIsDeleting(true);
                  try {
                    await deleteFriend(deleteFriendConfirm.friend._id);
                    setDeleteFriendConfirm({ show: false, friend: null });
                    fetchFriends();
                    toast.success("Friend removed successfully");
                    if (window.location.pathname.includes(`/friends/${deleteFriendConfirm.friend._id}`)) {
                      navigate('/dashboard');
                    }
                  } catch (err) {
                    console.error('Error deleting friend:', err);
                    toast.error(err.message || 'Failed to delete friend');
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                style={{ opacity: isDeleting ? 0.6 : 1, cursor: isDeleting ? 'not-allowed' : 'pointer' }}
              >
                {isDeleting ? "Removing..." : "Remove Friend"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
