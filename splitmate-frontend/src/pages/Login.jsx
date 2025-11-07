import { useContext, useState, useEffect } from "react";
import { loginUser } from "../api/auth";
import { useNavigate } from "react-router-dom";
import styles from "../styles/login.module.css";
import googleLogo from "../assets/images/google logo.png";
import { AuthContext } from "../context/AuthContext";
import { Eye, EyeOff } from "lucide-react";


const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = window.localStorage.getItem("token");
    if (token) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);


  useEffect(() => {
    if (typeof window === "undefined") return;

    const allowedOrigins = [
      "http://localhost:8080",            
      "https://splitmate-32de.onrender.com"  
    ];

    const handleMessage = (event) => {
      if (!allowedOrigins.includes(event.origin)) return;

      if (event.data.token) {
        login(event.data.token);
        navigate("/dashboard", { replace: true });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [login, navigate]);


  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  const handleGoogleLogin = () => {
    window.open(
      // "http://localhost:8080/api/auth/google",
      "https://splitmate-32de.onrender.com/api/auth/google",
      "_blank",
      "width=500,height=600"
    );
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await loginUser(formData);
      if (res.token) {
        // localStorage.setItem("token", res.token);
        login(res.token);
        navigate("/dashboard", { replace: true });
      } else {
        setError(res.msg || "Login failed");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.splitContainer}>
      <div className={styles.leftPanel}>
        <div className={styles.logoBox}>
          <img src="logo.png" alt="Splitmate Logo" className={styles.logoImg} />
        </div>
      </div>
      <div className={styles.rightPanel}>
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>LOGIN</h2>
          <div className={styles.formSubtitle}>Continue to SplitMate</div>
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={handleSubmit} className={styles.form}>
            <input
              type="email"
              name="email"
              placeholder="Email address"
              onChange={handleChange}
              className={styles.inputField}
              required
            />
            <div className={styles.passwordWrapper}>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                onChange={handleChange}
                className={styles.inputField}
                required
              />
              <span className={styles.toggleIcon} onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </span>
            </div>
            <button type="submit" disabled={loading} className={styles.button}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
          <div className={styles.orContainer}>
            <hr />
            <span>or</span>
            <hr />
          </div>
          <button onClick={handleGoogleLogin} className={styles.googleBtn}>
            <img src={googleLogo} alt="Google" />
            Sign in with Google
          </button>
          <div className={styles.link} onClick={() => navigate("/register")}>
            Don’t have an account? Register
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
