import { useState, useEffect, useContext } from "react";
import { registerUser } from "../api/auth";
import { useNavigate } from "react-router-dom";
import styles from "../styles/register.module.css";
import googleLogo from "../assets/images/google logo.png";
import { AuthContext } from "../context/AuthContext";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "react-hot-toast";

const Register = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext)

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

    const handleMessage = (event) => {
      const allowedOrigins = [
        "http://localhost:8080",
        "https://splitmate-32de.onrender.com",
      ];

      if (!allowedOrigins.includes(event.origin)) return;

      if (event.data.token) {
        login(event.data.token);
        navigate("/dashboard", { replace: true });
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [login, navigate]);



  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await registerUser(formData);

      if (res.msg === "user has been registered successfully") {
        // alert("Registration successful!");
        toast.success("Registration successful!");
        navigate("/login"); // redirect to login
      } else {
        setError(res.msg || "Registration failed");
      }
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    window.open(
      // "http://localhost:8080/api/auth/google",
      "https://splitmate-32de.onrender.com/api/auth/google",
      "_blank",
      "width=500,height=600"
    );
  };

  return (
    <div className={styles.splitContainer}>
      <div className={styles.leftPanel}>
        <div className={styles.logoWrapper}>
          <div className={styles.logoBox}>
            <img src="/logo.png" alt="Splitmate Logo" className={styles.logoImg} />
          </div>
        </div>
      </div>
      <div className={styles.rightPanel}>
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Signup for SplitMate</h2>
          <div className={styles.formSubtitle}>Let's get you started!</div>
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={handleSubmit} className={styles.form}>
            <input
              type="text"
              name="name"
              placeholder="Enter your full name"
              onChange={handleChange}
              className={styles.inputField}
              required
            />
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

            <div className={styles.passwordWrapper}>
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm password"
                onChange={handleChange}
                className={styles.inputField}
                required
              />
              <span className={styles.toggleIcon} onClick={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
              </span>
            </div>
            <button type="submit" disabled={loading} className={styles.button}>
              {loading ? "Registering..." : "Create Account"}
            </button>
          </form>
          <div className={styles.orContainer}>
            <hr />
            <span>or</span>
            <hr />
          </div>
          <button onClick={handleGoogleSignup} className={styles.googleBtn}>
            <img src={googleLogo} alt="Google" />
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
