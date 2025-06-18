
import React, { useState, useEffect, useRef, FormEvent } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";

// --- Types ---
interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    category: string;
    imageUrl: string;
    stock: number;
}

interface CartItem extends Product {
    quantity: number;
}

interface ChatMessage {
    id: string;
    text: string;
    sender: 'user' | 'assistant' | 'error';
}

type View = 'home' | 'cart' | 'checkout' | 'admin' | 'addProduct';

interface UserCredentials {
    fullName: string;
    email: string;
    password: string; 
    isAdmin: boolean;
}

interface CheckoutDetails {
    name: string;
    phone: string;
    addressLine1: string;
    city: string;
    pincode: string;
    paymentMethod: string;
}

interface CategoryDisplayInfo {
    name: string;
    imageUrl?: string;
}

interface Order {
    id: string;
    items: CartItem[];
    checkoutDetails: CheckoutDetails;
    subtotal: number;
    gstAmount: number;
    shippingFee: number;
    grandTotal: number;
    orderDate: string; 
    status: 'Confirmed' | 'Pending' | 'Shipped'; // Example statuses
}


// --- Constants ---
const ADMIN_EMAIL = "admin@geministore.com";
const ADMIN_PASSWORD = "123@123"; 
const ADMIN_OTP = "123456"; 

const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
    "Audio": "https://via.placeholder.com/150/007BFF/FFFFFF?Text=Audio",
    "Smart Home": "https://via.placeholder.com/150/FFC107/000000?Text=Smart+Home",
    "Computing": "https://via.placeholder.com/150/17A2B8/FFFFFF?Text=Computing",
    "Gaming": "https://via.placeholder.com/150/DC3545/FFFFFF?Text=Gaming",
    "Cameras": "https://via.placeholder.com/150/28A745/FFFFFF?Text=Cameras",
    "Wearables": "https://via.placeholder.com/150/6F42C1/FFFFFF?Text=Wearables",
    "Drones": "https://via.placeholder.com/150/FD7E14/FFFFFF?Text=Drones",
    "Accessories": "https://via.placeholder.com/150/6C757D/FFFFFF?Text=Accessories",
    "Mobiles": "https://via.placeholder.com/150/E83E8C/FFFFFF?Text=Mobiles",
    "TV & Video": "https://via.placeholder.com/150/20C997/FFFFFF?Text=TV",
    "Default": "https://via.placeholder.com/150/CCCCCC/000000?Text=Category"
};

const GST_RATE = 0.18; // 18%
const SHIPPING_THRESHOLD = 300;
const SHIPPING_FEE = 40;


// --- Gemini API Initialization ---
let ai: GoogleGenAI | null = null;
try {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
} catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
}

// --- Helper Functions ---
const getFallbackProducts = (): Product[] => [
    { id: "fallback-1", name: "Eco SoundBlaster Pro", description: "Immersive sound, crafted with sustainable materials.", price: 79.99, category: "Audio", imageUrl: "https://via.placeholder.com/300x200/28A745/FFFFFF?Text=Eco+Speaker", stock: 15 },
    { id: "fallback-2", name: "ConnectHub Max", description: "The ultimate smart home command center.", price: 129.99, category: "Smart Home", imageUrl: "https://via.placeholder.com/300x200/FFC107/000000?Text=Smart+Hub", stock: 8 },
    { id: "fallback-3", name: "LapPro UltraSlim X", description: "Power and portability redefined.", price: 999.99, category: "Computing", imageUrl: "https://via.placeholder.com/300x200/17A2B8/FFFFFF?Text=Laptop", stock: 5 },
    { id: "fallback-4", name: "PixelView Monitor 27\"", description: "Stunning 4K resolution with vibrant colors for professionals.", price: 349.50, category: "Computing", imageUrl: "https://via.placeholder.com/300x200/6F42C1/FFFFFF?Text=Monitor", stock: 12 },
    { id: "fallback-5", name: "GamerX Headset Elite", description: "Crystal clear audio for competitive gaming, 7.1 surround.", price: 89.99, category: "Gaming", imageUrl: "https://via.placeholder.com/300x200/DC3545/FFFFFF?Text=Gaming+Headset", stock: 0 },
    { id: "fallback-6", name: "ActionCam Pro 5K", description: "Capture life's adventures in breathtaking 5K detail.", price: 299.00, category: "Cameras", imageUrl: "https://via.placeholder.com/300x200/FD7E14/FFFFFF?Text=Action+Cam", stock: 20 },
    { id: "fallback-7", name: "FitTrack Smartband V3", description: "Monitor your health and fitness goals with precision.", price: 49.99, category: "Wearables", imageUrl: "https://via.placeholder.com/300x200/E83E8C/FFFFFF?Text=Smartband", stock: 25 },
    { id: "fallback-8", name: "SkyDrone Explorer", description: "Easy-to-fly drone with HD camera, perfect for beginners.", price: 199.99, category: "Drones", imageUrl: "https://via.placeholder.com/300x200/20C997/FFFFFF?Text=Drone", stock: 7 },
    { id: "fallback-9", name: "Nova Smartphone Z1", description: "Flagship features at a budget-friendly price point.", price: 399.00, category: "Mobiles", imageUrl: "https://via.placeholder.com/300x200/6610F2/FFFFFF?Text=Smartphone", stock: 18 },
    { id: "fallback-10", name: "HomeCinema LED TV 55\"", description: "Experience movies like never before with this 4K HDR TV.", price: 549.99, category: "TV & Video", imageUrl: "https://via.placeholder.com/300x200/198754/FFFFFF?Text=Smart+TV", stock: 3 },
    { id: "fallback-11", name: "Wireless Charging Pad", description: "Fast and convenient charging for all your Qi-enabled devices.", price: 29.99, category: "Accessories", imageUrl: "https://via.placeholder.com/300x200/6C757D/FFFFFF?Text=Charger", stock: 30 },
    { id: "fallback-12", name: "Portable SSD 1TB", description: "Blazing fast external storage for your files and media.", price: 119.99, category: "Accessories", imageUrl: "https://via.placeholder.com/300x200/343A40/FFFFFF?Text=SSD", stock: 0 },
];


const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPassword = (password: string): boolean => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);

const LOCAL_STORAGE_USERS_KEY = 'geminiStoreUsers';
const LOCAL_STORAGE_PRODUCTS_KEY = 'geminiStoreProducts';

const getStoredUsers = (): UserCredentials[] => {
    const usersJson = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
    return usersJson ? JSON.parse(usersJson) : [];
};

const saveStoredUsers = (users: UserCredentials[]) => localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));

const getStoredProducts = (): Product[] | null => {
    const productsJson = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
    return productsJson ? JSON.parse(productsJson) : null;
};

const saveStoredProducts = (products: Product[]) => localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, JSON.stringify(products));

const generateOrderId = (): string => {
    return `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
};


// --- Main Application Component ---
const App: React.FC = () => {
    const [currentView, setCurrentView] = useState<View>('home');
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [showProductDetails, setShowProductDetails] = useState<boolean>(true);
    
    const [isLoadingApiProducts, setIsLoadingApiProducts] = useState<boolean>(true);
    const [apiProductError, setApiProductError] = useState<string | null>(null);

    const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState<string>('');
    const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
    const geminiChat = useRef<Chat | null>(null);
    const chatMessagesEndRef = useRef<HTMLDivElement>(null);

    const [currentUser, setCurrentUser] = useState<UserCredentials | null>(null);
    const [activeModal, setActiveModal] = useState<'login' | 'createAccount' | 'adminOtp' | null>(null);
    const [authMessage, setAuthMessage] = useState<string | null>(null);
    
    const [adminOtpAttemptEmail, setAdminOtpAttemptEmail] = useState<string | null>(null);
    const [lastOrderDetails, setLastOrderDetails] = useState<Order | null>(null);

    // Bootstrap Modal Refs
    const loginModalRef = useRef<HTMLDivElement>(null);
    const createAccountModalRef = useRef<HTMLDivElement>(null);
    const adminOtpModalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Initialize Bootstrap Modals
        const initializeModal = (ref: React.RefObject<HTMLDivElement>, modalId: string) => {
            if (ref.current) {
                // @ts-ignore
                return new bootstrap.Modal(ref.current);
            }
            return null;
        };
    
        const bsLoginModal = initializeModal(loginModalRef, 'loginModal');
        const bsCreateAccountModal = initializeModal(createAccountModalRef, 'createAccountModal');
        const bsAdminOtpModal = initializeModal(adminOtpModalRef, 'adminOtpModal');
    
        if (activeModal === 'login') bsLoginModal?.show(); else bsLoginModal?.hide();
        if (activeModal === 'createAccount') bsCreateAccountModal?.show(); else bsCreateAccountModal?.hide();
        if (activeModal === 'adminOtp') bsAdminOtpModal?.show(); else bsAdminOtpModal?.hide();

    }, [activeModal]);


    useEffect(() => {
        if (ai) {
            geminiChat.current = ai.chats.create({
                model: 'gemini-2.5-flash-preview-04-17',
                config: { systemInstruction: 'You are a friendly shopping assistant for GeminiStore.' },
            });
            setChatMessages([{ id: Date.now().toString(), text: "Hi! How can I help you shop today?", sender: 'assistant' }]);
        } else {
            setChatMessages([{ id: Date.now().toString(), text: "Chatbot unavailable.", sender: 'error' }]);
        }
    }, []);

    useEffect(() => { chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

    useEffect(() => {
        const loadProducts = async () => {
            setIsLoadingApiProducts(true);
            setApiProductError(null);
            
            const storedProducts = getStoredProducts();
            if (storedProducts && storedProducts.length > 0) {
                setProducts(storedProducts);
                setIsLoadingApiProducts(false);
                return;
            }

            if (!ai) {
                const fallbacks = getFallbackProducts();
                setProducts(fallbacks);
                saveStoredProducts(fallbacks); 
                setApiProductError("Live product updates unavailable. Displaying sample items.");
                setIsLoadingApiProducts(false);
                return;
            }

            try {
                const prompt = `Generate a list of 12 diverse electronic product details. Each product needs:
                - id: unique string (e.g., "prod-uuid")
                - name: compelling product name (2-5 words)
                - description: Short, enticing description (10-20 words).
                - price: number (e.g., 29.99, 1249.00)
                - category: Choose from "Audio", "Smart Home", "Computing", "Gaming", "Cameras", "Wearables", "Mobiles", "TV & Video", "Accessories".
                - imageUrl: placeholder URL from https://via.placeholder.com/300x200 (e.g., /007BFF/FFFFFF?Text=Product)
                - stock: a number between 0 and 50. Ensure at least two products have 0 stock and several have low stock (1-5).

                Output ONLY the JSON array of objects. Example:
                [
                  { "id": "prod-1", "name": "Gizmo X1", "description": "Amazing new features for everyday use.", "price": 19.99, "category": "Accessories", "imageUrl": "https://via.placeholder.com/300x200/007BFF/FFFFFF?Text=Gizmo", "stock": 10 }
                ]`;

                const response: GenerateContentResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-preview-04-17',
                    contents: prompt,
                    config: { responseMimeType: "application/json" }
                });

                let jsonStr = response.text.trim();
                const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
                const match = jsonStr.match(fenceRegex);
                if (match && match[2]) jsonStr = match[2].trim();
                
                const generatedProducts: Product[] = JSON.parse(jsonStr).map((p: any) => ({ ...p, stock: p.stock !== undefined ? Number(p.stock) : 10 }));
                if (generatedProducts && generatedProducts.length > 0) {
                    setProducts(generatedProducts);
                    saveStoredProducts(generatedProducts);
                } else {
                    const fallbacks = getFallbackProducts();
                    setProducts(fallbacks);
                    saveStoredProducts(fallbacks);
                    setApiProductError("Received empty product list from API. Displaying samples.");
                }
            } catch (error) {
                console.error("Error fetching products from API:", error);
                const fallbacks = getFallbackProducts();
                setProducts(fallbacks);
                saveStoredProducts(fallbacks);
                setApiProductError("Could not update products. Displaying sample items.");
            } finally {
                setIsLoadingApiProducts(false);
            }
        };
        loadProducts();
    }, []);

    const showTemporaryAuthMessage = (message: string, duration: number = 3000, type: 'success' | 'info' | 'error' = 'info') => {
        const alertType = type === 'success' ? 'alert-success' : type === 'error' ? 'alert-danger' : 'alert-info';
        setAuthMessage(`<div class="alert ${alertType} text-center" role="alert">${message}</div>`);
        setTimeout(() => setAuthMessage(null), duration);
    };

    const navigateTo = (view: View) => {
        setCurrentView(view);
    };
    
    const handleCategorySelect = (categoryName: string) => {
        setSelectedCategory(categoryName);
        setSearchTerm(''); 
        setCurrentView('home'); 
    };

    const handleClearCategoryFilter = () => {
        setSelectedCategory(null);
        setSearchTerm('');
    };

    const handleSearchTermChange = (term: string) => {
        setSearchTerm(term);
        setSelectedCategory(null); 
    };


    const addToCart = (product: Product) => {
        if (product.stock <= 0) {
            showTemporaryAuthMessage(`${product.name} is out of stock.`, 3000, 'error');
            return;
        }

        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            const targetProductFromState = products.find(p => p.id === product.id);
            const availableStock = targetProductFromState?.stock ?? 0;

            if (existingItem) {
                if (existingItem.quantity < availableStock) {
                    showTemporaryAuthMessage(`${product.name} added to cart!`, 2000, 'success');
                    return prevCart.map(item =>
                        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                    );
                } else {
                    showTemporaryAuthMessage(`Cannot add more ${product.name}. Max stock reached in cart.`, 3000, 'error');
                    return prevCart;
                }
            } else {
                 if (1 <= availableStock) {
                    showTemporaryAuthMessage(`${product.name} added to cart!`, 2000, 'success');
                    return [...prevCart, { ...product, quantity: 1 }];
                } else {
                    showTemporaryAuthMessage(`${product.name} is out of stock.`, 3000, 'error');
                    return prevCart; 
                }
            }
        });
    };

    const removeFromCart = (productId: string) => {
        setCart(prevCart => prevCart.filter(item => item.id !== productId));
        showTemporaryAuthMessage(`Item removed from cart.`, 2000, 'info');
    };

    const updateQuantity = (productId: string, newQuantity: number) => {
        const productInCart = cart.find(item => item.id === productId);
        if (!productInCart) return;

        const targetProductFromState = products.find(p => p.id === productId);
        const availableStock = targetProductFromState?.stock ?? 0;

        if (newQuantity <= 0) {
            removeFromCart(productId);
        } else if (newQuantity > availableStock) {
            setCart(prevCart =>
                prevCart.map(item =>
                    item.id === productId ? { ...item, quantity: availableStock } : item
                )
            );
            showTemporaryAuthMessage(`Quantity for ${productInCart.name} limited to available stock (${availableStock}).`, 3000, 'error');
        } else {
            setCart(prevCart =>
                prevCart.map(item =>
                    item.id === productId ? { ...item, quantity: newQuantity } : item
                )
            );
        }
    };

    const cartSubtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
    const gstAmount = cartSubtotal * GST_RATE;
    const shippingFee = cart.length > 0 && cartSubtotal < SHIPPING_THRESHOLD ? SHIPPING_FEE : 0;
    const grandTotal = cartSubtotal + gstAmount + shippingFee;
    const cartItemCount = cart.reduce((count, item) => count + item.quantity, 0);


    const handleChatSend = async (e: FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || isChatLoading || !geminiChat.current) return;
        const newUserMessage: ChatMessage = { id: Date.now().toString(), text: chatInput, sender: 'user' };
        setChatMessages(prev => [...prev, newUserMessage]);
        const currentInput = chatInput;
        setChatInput('');
        setIsChatLoading(true);
        try {
            const response: GenerateContentResponse = await geminiChat.current.sendMessage({ message: currentInput });
            setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: response.text, sender: 'assistant' }]);
        } catch (error) {
            console.error("Chat error:", error);
            setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: "Sorry, error getting response.", sender: 'error' }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    const handleLogin = async (email: string, password?: string): Promise<string | null> => {
        if (email === ADMIN_EMAIL) {
            setAdminOtpAttemptEmail(email);
            setActiveModal('adminOtp');
            return null; 
        }

        if (!password) return "Password is required."; 
        const user = getStoredUsers().find(u => u.email === email && u.password === password);
        if (user) {
            setCurrentUser({ ...user, isAdmin: false });
            setActiveModal(null);
            showTemporaryAuthMessage(`Welcome back, ${user.fullName.split(' ')[0]}!`, 3000, 'success');
            return null;
        }
        return "Invalid email or password.";
    };
    
    const handleAdminOtpSubmit = async (otp: string): Promise<string | null> => {
        if (adminOtpAttemptEmail === ADMIN_EMAIL && otp === ADMIN_OTP) {
            const adminUser: UserCredentials = {
                fullName: "Store Admin",
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD, 
                isAdmin: true
            };
            setCurrentUser(adminUser);
            setActiveModal(null);
            setAdminOtpAttemptEmail(null);
            showTemporaryAuthMessage(`Admin login successful!`, 3000, 'success');
            navigateTo('admin'); 
            return null;
        }
        return "Invalid OTP.";
    };


    const handleLogout = () => {
        setCurrentUser(null);
        setCart([]); 
        setSelectedCategory(null);
        setSearchTerm('');
        navigateTo('home');
        showTemporaryAuthMessage("You have been logged out.", 3000, 'info');
    };

    const handleCreateAccountSuccess = async (fullName: string, email: string, password: string): Promise<string | null> => {
        const users = getStoredUsers();
        if (users.some(u => u.email === email) || email === ADMIN_EMAIL) {
            return "An account with this email already exists.";
        }
        const newUser: UserCredentials = { fullName, email, password, isAdmin: false };
        users.push(newUser);
        saveStoredUsers(users);
        setCurrentUser(newUser); 
        setActiveModal(null);
        showTemporaryAuthMessage(`Account created for ${newUser.fullName.split(' ')[0]}! You are logged in.`, 4000, 'success');
        return null;
    };
    
    const openLoginModal = () => { setAuthMessage(null); setActiveModal('login'); };
    const openCreateAccountModal = () => { setAuthMessage(null); setActiveModal('createAccount'); };

    const handleProceedToCheckout = () => {
        if (currentUser) navigateTo('checkout');
        else openLoginModal();
    };

    const handleConfirmOrder = (details: CheckoutDetails) => {
        const orderId = generateOrderId();
        const currentOrderSubtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
        const currentOrderGst = currentOrderSubtotal * GST_RATE;
        const currentOrderShipping = cart.length > 0 && currentOrderSubtotal < SHIPPING_THRESHOLD ? SHIPPING_FEE : 0;
        const currentOrderGrandTotal = currentOrderSubtotal + currentOrderGst + currentOrderShipping;

        const newOrder: Order = {
            id: orderId,
            items: [...cart], 
            checkoutDetails: details,
            subtotal: currentOrderSubtotal,
            gstAmount: currentOrderGst,
            shippingFee: currentOrderShipping,
            grandTotal: currentOrderGrandTotal,
            orderDate: new Date().toISOString(),
            status: 'Confirmed'
        };
        setLastOrderDetails(newOrder);
        console.log("Order Details:", newOrder);

        const newProductsState = [...products];
        let stockUpdated = false;
        cart.forEach(cartItem => {
            const productIndex = newProductsState.findIndex(p => p.id === cartItem.id);
            if (productIndex !== -1) {
                newProductsState[productIndex].stock -= cartItem.quantity;
                if (newProductsState[productIndex].stock < 0) newProductsState[productIndex].stock = 0;
                stockUpdated = true;
            }
        });

        if (stockUpdated) {
            setProducts(newProductsState);
            saveStoredProducts(newProductsState);
        }
        
        showTemporaryAuthMessage(`Order #${orderId} placed successfully for $${currentOrderGrandTotal.toFixed(2)}. Thank you, ${details.name}!`, 6000, 'success');
        setCart([]); 
        setSelectedCategory(null);
        setSearchTerm('');
        navigateTo('home');
    };

    const handleNavigateToAdmin = () => {
        if (currentUser && currentUser.isAdmin) navigateTo('admin');
        else if (currentUser) showTemporaryAuthMessage("Access Denied: Admin privileges required.", 3000, 'error');
        else openLoginModal(); 
    };

    const handleNavigateToAddProduct = () => {
        if (currentUser && currentUser.isAdmin) navigateTo('addProduct');
        else if (currentUser) showTemporaryAuthMessage("Access Denied: Admin privileges required.", 3000, 'error');
        else openLoginModal();
    };

    const handleAdminAddProduct = async (productData: Omit<Product, 'id' | 'imageUrl' | 'stock'> & { imageUrl?: string, stock: number }): Promise<string | null> => {
        const newProduct: Product = {
            name: productData.name,
            description: productData.description,
            price: productData.price,
            category: productData.category,
            stock: productData.stock,
            id: `admin-prod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            imageUrl: productData.imageUrl || `https://via.placeholder.com/300x200/cccccc/000000?Text=${encodeURIComponent(productData.name)}`
        };
        const updatedProducts = [newProduct, ...products];
        setProducts(updatedProducts);
        saveStoredProducts(updatedProducts);
        return "Product added successfully!";
    };

    const handleDeleteProduct = (productId: string) => {
        if (window.confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
            const updatedProducts = products.filter(p => p.id !== productId);
            setProducts(updatedProducts);
            saveStoredProducts(updatedProducts);
            showTemporaryAuthMessage("Product deleted successfully.", 3000, 'success');
        }
    };

    const handleUpdateProductStock = (productId: string, newStock: number) => {
        if (newStock < 0) {
            showTemporaryAuthMessage("Stock cannot be negative.", 3000, 'error');
            return;
        }
        const updatedProducts = products.map(p => 
            p.id === productId ? { ...p, stock: newStock } : p
        );
        setProducts(updatedProducts);
        saveStoredProducts(updatedProducts);
        showTemporaryAuthMessage("Product stock updated.", 2000, 'success');
    };
    
    const uniqueCategories: CategoryDisplayInfo[] = Array.from(new Set(products.map(p => p.category)))
        .map(categoryName => ({
            name: categoryName,
            imageUrl: DEFAULT_CATEGORY_IMAGES[categoryName] || DEFAULT_CATEGORY_IMAGES["Default"]
        }))
        .sort((a, b) => a.name.localeCompare(b.name));


    const filteredProducts = products.filter(product => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = (
            product.name.toLowerCase().includes(term) ||
            product.description.toLowerCase().includes(term) ||
            product.category.toLowerCase().includes(term)
        );
        const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
        
        const isAdminView = currentView === 'admin' || currentView === 'addProduct';
        const inStock = isAdminView ? true : product.stock > 0; 

        return matchesSearch && matchesCategory && inStock;
    });


    let viewContent;
    if (currentView === 'home') {
        if (isLoadingApiProducts && products.length === 0) {
            viewContent = <div className="text-center p-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div><p className="mt-2">Loading initial store data... ✨</p></div>;
        } else if (apiProductError && products.length === 0 && !isLoadingApiProducts) {
             viewContent = <div className="alert alert-warning text-center" role="alert">{apiProductError} Please try searching or check back later.</div>;
        } else if (selectedCategory || searchTerm.trim()) {
            viewContent = (
                <ProductListView
                    products={filteredProducts}
                    onAddToCart={addToCart}
                    currentUser={currentUser}
                    onRequestLogin={openLoginModal}
                    searchTerm={searchTerm}
                    selectedCategory={selectedCategory}
                    onClearCategoryFilter={handleClearCategoryFilter}
                    showDetails={showProductDetails}
                    onToggleDetails={() => setShowProductDetails(prev => !prev)}
                />
            );
        } else if (products.length > 0) {
             viewContent = <CategoryNavView categories={uniqueCategories} onSelectCategory={handleCategorySelect} />;
        } else {
            viewContent = (
                <div className="container text-center py-5 home-page-content-bootstrap">
                    <img src="https://via.placeholder.com/800x300/6c757d/FFFFFF?Text=Explore+Our+Store" alt="GeminiStore Welcome Banner" className="img-fluid rounded mb-4 home-welcome-banner-bootstrap" />
                    <h1 className="display-4 text-primary">Welcome to GeminiStore!</h1>
                    <p className="lead text-muted">Your one-stop shop for the latest electronics, powered by AI.</p>
                    {isLoadingApiProducts && <div className="text-center p-3"><div className="spinner-border text-secondary" role="status"><span className="visually-hidden">Loading...</span></div><p className="mt-2">Loading products...</p></div>}
                    {apiProductError && <div className="alert alert-danger" role="alert">{apiProductError}</div>}
                    {!isLoadingApiProducts && !apiProductError && products.length === 0 && (
                        <p className="mt-3">No products available at the moment. Please check back later or use the search!</p>
                    )}
                    <p className="mt-3">Use the search bar above or our chat assistant to find what you need!</p>
                </div>
            );
        }
    } else if (currentView === 'cart') {
        viewContent = currentUser ? (
            <CartView 
                cartItems={cart} 
                onRemoveFromCart={removeFromCart} 
                onUpdateQuantity={updateQuantity} 
                onProceedToCheckout={handleProceedToCheckout} 
                products={products}
                subtotal={cartSubtotal}
                gstAmount={gstAmount}
                shippingFee={shippingFee}
                grandTotal={grandTotal}
            />
        ) : (
            <div className="container text-center py-5"><h2 className="text-primary">Your Cart Awaits!</h2><p className="lead">Please log in or create an account to view your cart.</p><button onClick={openLoginModal} className="btn btn-primary btn-lg mt-3">Login / Create Account</button></div>
        );
    } else if (currentView === 'checkout') {
        viewContent = currentUser ? (
            <CheckoutView onBackToCart={() => navigateTo('cart')} onConfirmOrder={handleConfirmOrder} currentUser={currentUser} />
        ) : (
            <div className="container text-center py-5"><h2 className="text-primary">Secure Checkout</h2><p className="lead">Please log in or create an account to complete your purchase.</p><button onClick={openLoginModal} className="btn btn-primary btn-lg mt-3">Login / Create Account</button></div>
        );
    } else if (currentView === 'admin') {
        viewContent = currentUser ? (
            currentUser.isAdmin ? (
                <AdminView products={products} onNavigateToHome={() => { setSelectedCategory(null); setSearchTerm(''); navigateTo('home');}} onNavigateToAddProduct={handleNavigateToAddProduct} onDeleteProduct={handleDeleteProduct} onUpdateStock={handleUpdateProductStock}/>
            ) : (
                <div className="alert alert-danger text-center" role="alert">Access Denied. Admin privileges required for this page.</div>
            )
        ) : (
            <div className="container text-center py-5"><h2 className="text-primary">Admin Access Required</h2> <p className="lead">Log in to access the admin panel.</p><button onClick={openLoginModal} className="btn btn-primary btn-lg mt-3">Login</button></div>
        );
    } else if (currentView === 'addProduct') {
        viewContent = currentUser ? (
            currentUser.isAdmin ? (
                <AddProductView onAddProduct={handleAdminAddProduct} onNavigateBackToAdmin={() => navigateTo('admin')} />
            ) : (
                <div className="alert alert-danger text-center" role="alert">Access Denied. Admin privileges required to add products.</div>
            )
        ) : (
            <div className="container text-center py-5"><h2 className="text-primary">Admin Access Required</h2> <p className="lead">Log in to add products.</p><button onClick={openLoginModal} className="btn btn-primary btn-lg mt-3">Login</button></div>
        );
    }


    return (
        <>
            <Header
                onNavigateHome={() => { setSelectedCategory(null); setSearchTerm(''); navigateTo('home');}}
                onNavigateToCart={() => navigateTo('cart')}
                cartItemCount={cartItemCount}
                currentUser={currentUser}
                onLogout={handleLogout}
                onLoginClick={openLoginModal}
                searchTerm={searchTerm}
                onSearchTermChange={handleSearchTermChange}
            />
            <main className="container my-4 flex-grow-1">
                {authMessage && <div dangerouslySetInnerHTML={{ __html: authMessage }} />}
                {viewContent}
            </main>
            <Footer currentUser={currentUser} onNavigateToAdmin={handleNavigateToAdmin} />
            {!isChatOpen && <ChatbotButton onToggleChat={() => setIsChatOpen(prev => !prev)} />}
            {isChatOpen && <ChatWindow messages={chatMessages} inputValue={chatInput} onInputChange={(e) => setChatInput(e.target.value)} onSendMessage={handleChatSend} onClose={() => setIsChatOpen(false)} isLoading={isChatLoading} chatMessagesEndRef={chatMessagesEndRef} />}
            
            <LoginModal modalRef={loginModalRef} onClose={() => setActiveModal(null)} onLogin={handleLogin} onGoToCreateAccount={openCreateAccountModal} />
            <CreateAccountModal modalRef={createAccountModalRef} onClose={() => setActiveModal(null)} onCreateAccount={handleCreateAccountSuccess} onGoToLogin={openLoginModal} />
            <AdminOtpModal modalRef={adminOtpModalRef} onClose={() => { setActiveModal(null); setAdminOtpAttemptEmail(null); }} onOtpSubmit={handleAdminOtpSubmit} />
        </>
    );
};

// --- Components ---

interface HeaderProps {
    onNavigateHome: () => void; onNavigateToCart: () => void; cartItemCount: number;
    currentUser: UserCredentials | null; onLogout: () => void; onLoginClick: () => void;
    searchTerm: string; onSearchTermChange: (term: string) => void;
}
const Header: React.FC<HeaderProps> = ({ onNavigateHome, onNavigateToCart, cartItemCount, currentUser, onLogout, onLoginClick, searchTerm, onSearchTermChange }) => (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary sticky-top">
        <div className="container-fluid">
            <a className="navbar-brand fw-bold fs-4" href="#" onClick={(e) => { e.preventDefault(); onNavigateHome(); }}>GeminiStore</a>
            <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span className="navbar-toggler-icon"></span>
            </button>
            <div className="collapse navbar-collapse" id="navbarNav">
                <form className="d-flex mx-auto my-2 my-lg-0 search-form-bs" role="search">
                    <input className="form-control me-2" type="search" placeholder="Search products..." aria-label="Search products" value={searchTerm} onChange={(e) => onSearchTermChange(e.target.value)} />
                </form>
                <ul className="navbar-nav align-items-lg-center">
                    {currentUser ? (
                        <>
                            <li className="nav-item"><span className="navbar-text me-3">Welcome, {currentUser.isAdmin ? currentUser.fullName : currentUser.fullName.split(' ')[0]}!</span></li>
                            <li className="nav-item"><button onClick={onLogout} className="btn btn-warning me-2">Logout</button></li>
                        </>
                    ) : (
                        <li className="nav-item"><button onClick={onLoginClick} className="btn btn-warning me-2">Login</button></li>
                    )}
                    <li className="nav-item">
                        <button onClick={onNavigateToCart} className="btn btn-outline-light position-relative" aria-label={`View Cart, ${cartItemCount} items`}>
                            🛒 Cart
                            {cartItemCount > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{cartItemCount}<span className="visually-hidden">items in cart</span></span>}
                        </button>
                    </li>
                </ul>
            </div>
        </div>
    </nav>
);

interface ModalProps { modalRef: React.RefObject<HTMLDivElement>; onClose: () => void; }
interface LoginModalProps extends ModalProps { onLogin: (email: string, password?: string) => Promise<string | null>; onGoToCreateAccount: () => void; }
const LoginModal: React.FC<LoginModalProps> = ({ modalRef, onClose, onLogin, onGoToCreateAccount }) => {
    const [email, setEmail] = useState(''); 
    const [password, setPassword] = useState(''); 
    const [error, setError] = useState('');
    const [isPasswordHiddenForAdmin, setIsPasswordHiddenForAdmin] = useState(false);
    const emailInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (modalRef.current) {
            const modalElement = modalRef.current;
            const handleShown = () => emailInputRef.current?.focus();
            modalElement.addEventListener('shown.bs.modal', handleShown);
            return () => modalElement.removeEventListener('shown.bs.modal', handleShown);
        }
    }, [modalRef]);

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newEmail = e.target.value;
        setEmail(newEmail);
        if (newEmail === ADMIN_EMAIL) {
            setIsPasswordHiddenForAdmin(true);
            setPassword(''); 
        } else {
            setIsPasswordHiddenForAdmin(false);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault(); 
        setError('');
        if (!email.trim()) { setError('Email is required.'); return; }

        let loginError: string | null = null;
        if (email === ADMIN_EMAIL) { 
            loginError = await onLogin(email); 
        } else { 
            if (!password.trim()) { setError('Password is required.'); return; }
            loginError = await onLogin(email, password);
        }
        if (loginError) setError(loginError);
    };

    return (
        <div className="modal fade" ref={modalRef} id="loginModal" tabIndex={-1} aria-labelledby="loginModalLabel" aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title" id="loginModalLabel">Login to GeminiStore</h5>
                        <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
                    </div>
                    <div className="modal-body">
                        <form onSubmit={handleSubmit}>
                            {error && <p className="alert alert-danger" role="alert">{error}</p>}
                            <div className="mb-3">
                                <label htmlFor="login-email-bs" className="form-label">Email address</label>
                                <input 
                                    type="email" 
                                    className="form-control" 
                                    id="login-email-bs" 
                                    ref={emailInputRef}
                                    value={email} 
                                    onChange={handleEmailChange} 
                                    required 
                                />
                            </div>
                            {!isPasswordHiddenForAdmin && (
                                <div className="mb-3">
                                    <label htmlFor="login-password-bs" className="form-label">Password</label>
                                    <input 
                                        type="password" 
                                        className="form-control" 
                                        id="login-password-bs" 
                                        value={password} 
                                        onChange={(e) => setPassword(e.target.value)} 
                                        required={!isPasswordHiddenForAdmin}
                                    />
                                </div>
                            )}
                            <button type="submit" className="btn btn-primary w-100">
                                {email === ADMIN_EMAIL ? "Proceed to OTP" : "Login"}
                            </button>
                        </form>
                        <p className="mt-3 text-center small text-muted">
                            {email === ADMIN_EMAIL 
                                ? "Admin email detected. Click 'Proceed to OTP'." 
                                : "Admin login requires an OTP step. Regular users use created accounts."}
                        </p>
                    </div>
                    <div className="modal-footer justify-content-center">
                        Don't have an account? <button onClick={() => { onClose(); onGoToCreateAccount(); }} className="btn btn-link p-0 ms-1">Create one</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface AdminOtpModalProps extends ModalProps { onOtpSubmit: (otp: string) => Promise<string | null>; }
const AdminOtpModal: React.FC<AdminOtpModalProps> = ({ modalRef, onClose, onOtpSubmit }) => {
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const otpInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (modalRef.current) {
            const modalElement = modalRef.current;
            const handleShown = () => otpInputRef.current?.focus();
            modalElement.addEventListener('shown.bs.modal', handleShown);
            return () => modalElement.removeEventListener('shown.bs.modal', handleShown);
        }
    }, [modalRef]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        if (!otp.trim()) { setError('OTP is required.'); return; }
        const otpError = await onOtpSubmit(otp);
        if (otpError) setError(otpError);
    };

    return (
        <div className="modal fade" ref={modalRef} id="adminOtpModal" tabIndex={-1} aria-labelledby="adminOtpModalLabel" aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title" id="adminOtpModalLabel">Admin Login - Enter OTP</h5>
                        <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
                    </div>
                    <div className="modal-body">
                        <form onSubmit={handleSubmit}>
                            {error && <p className="alert alert-danger" role="alert">{error}</p>}
                            <div className="mb-3">
                                <label htmlFor="admin-otp-bs" className="form-label">One-Time Password</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="admin-otp-bs"
                                    ref={otpInputRef}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    required
                                    autoComplete="one-time-code"
                                />
                            </div>
                            <button type="submit" className="btn btn-primary w-100">Verify OTP</button>
                        </form>
                        <p className="mt-3 text-center small text-muted">Enter the fixed OTP for this demo (e.g., {ADMIN_OTP}).</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface CreateAccountModalProps extends ModalProps { onCreateAccount: (fullName: string, email: string, password: string) => Promise<string | null>; onGoToLogin: () => void; }
const CreateAccountModal: React.FC<CreateAccountModalProps> = ({ modalRef, onClose, onCreateAccount, onGoToLogin }) => {
    const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [rePassword, setRePassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({}); const [submissionError, setSubmissionError] = useState<string | null>(null);
    const fullNameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (modalRef.current) {
            const modalElement = modalRef.current;
            const handleShown = () => fullNameInputRef.current?.focus();
            modalElement.addEventListener('shown.bs.modal', handleShown);
            return () => modalElement.removeEventListener('shown.bs.modal', handleShown);
        }
    }, [modalRef]);

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!fullName.trim()) newErrors.fullName = "Full name is required.";
        if (!email.trim()) newErrors.email = "Email is required."; else if (!isValidEmail(email)) newErrors.email = "Invalid email format."; else if (email === ADMIN_EMAIL) newErrors.email = "This email is reserved for admin.";
        if (!password) newErrors.password = "Password is required."; else if (!isValidPassword(password)) newErrors.password = "Password: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char (@$!%*?&).";
        if (!rePassword) newErrors.rePassword = "Re-entering password is required."; else if (password && password !== rePassword) newErrors.rePassword = "Passwords do not match.";
        setErrors(newErrors); setSubmissionError(null); return Object.keys(newErrors).length === 0;
    };
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault(); if (validateForm()) { const createError = await onCreateAccount(fullName, email, password); if (createError) setSubmissionError(createError); }
    };
    
    return (
        <div className="modal fade" ref={modalRef} id="createAccountModal" tabIndex={-1} aria-labelledby="createAccountModalLabel" aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title" id="createAccountModalLabel">Create Your GeminiStore Account</h5>
                        <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
                    </div>
                    <div className="modal-body">
                        {submissionError && <p className="alert alert-danger" role="alert">{submissionError}</p>}
                        <form onSubmit={handleSubmit}>
                            <div className="mb-3">
                                <label htmlFor="create-fullName-bs" className="form-label">Full Name</label>
                                <input type="text" className={`form-control ${errors.fullName ? 'is-invalid' : ''}`} id="create-fullName-bs" ref={fullNameInputRef} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                                {errors.fullName && <div className="invalid-feedback">{errors.fullName}</div>}
                            </div>
                            <div className="mb-3">
                                <label htmlFor="create-email-bs" className="form-label">Email</label>
                                <input type="email" className={`form-control ${errors.email ? 'is-invalid' : ''}`} id="create-email-bs" value={email} onChange={(e) => setEmail(e.target.value)} required />
                                {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                            </div>
                            <div className="mb-3">
                                <label htmlFor="create-password-bs" className="form-label">Password</label>
                                <input type="password" className={`form-control ${errors.password ? 'is-invalid' : ''}`} id="create-password-bs" value={password} onChange={(e) => setPassword(e.target.value)} required />
                                {errors.password && <div className="invalid-feedback">{errors.password}</div>}
                                {!errors.password && <div className="form-text">Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char.</div>}
                            </div>
                            <div className="mb-3">
                                <label htmlFor="create-rePassword-bs" className="form-label">Re-enter Password</label>
                                <input type="password" className={`form-control ${errors.rePassword ? 'is-invalid' : ''}`} id="create-rePassword-bs" value={rePassword} onChange={(e) => setRePassword(e.target.value)} required />
                                {errors.rePassword && <div className="invalid-feedback">{errors.rePassword}</div>}
                            </div>
                            <button type="submit" className="btn btn-primary w-100">Create Account</button>
                        </form>
                         <p className="mt-3 text-center small text-muted">Passwords are stored in plaintext for this demo (not secure).</p>
                    </div>
                    <div className="modal-footer justify-content-center">
                        Already have an account? <button onClick={() => { onClose(); onGoToLogin(); }} className="btn btn-link p-0 ms-1">Login</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface CategoryNavViewProps { categories: CategoryDisplayInfo[]; onSelectCategory: (categoryName: string) => void; }
const CategoryNavView: React.FC<CategoryNavViewProps> = ({ categories, onSelectCategory }) => {
    if (categories.length === 0) {
        return <div className="alert alert-info text-center" role="alert">No product categories available at the moment.</div>;
    }
    return (
        <div className="py-3">
            <h2 className="text-center text-primary mb-4">Shop by Category</h2>
            <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-5 g-3">
                {categories.map(category => (
                    <div className="col" key={category.name}>
                        <div className="card h-100 text-center category-card-bs" onClick={() => onSelectCategory(category.name)} role="button">
                            <img src={category.imageUrl} className="card-img-top category-image-bs p-2" alt={category.name} />
                            <div className="card-body p-2">
                                <h6 className="card-title category-name-bs">{category.name}</h6>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface ProductListViewProps { 
    products: Product[]; onAddToCart: (product: Product) => void; currentUser: UserCredentials | null; 
    onRequestLogin: () => void; searchTerm: string; selectedCategory: string | null;
    onClearCategoryFilter: () => void; showDetails: boolean; onToggleDetails: () => void;
}
const ProductListView: React.FC<ProductListViewProps> = ({ products, onAddToCart, currentUser, onRequestLogin, searchTerm, selectedCategory, onClearCategoryFilter, showDetails, onToggleDetails }) => {
    let title = "Our Products (In Stock)";
    if (selectedCategory && searchTerm.trim()) title = `Search Results for "${searchTerm}" in ${selectedCategory} (In Stock)`;
    else if (selectedCategory) title = `Products in ${selectedCategory} (In Stock)`;
    else if (searchTerm.trim()) title = `Search Results for "${searchTerm}" (In Stock)`;

    if (products.length === 0) {
        let message = "No products currently in stock. Check back later or add some in Admin Panel.";
        if (searchTerm.trim()) message = `No products found matching "${searchTerm}"${selectedCategory ? ` in ${selectedCategory}` : ''}. All out-of-stock items are hidden.`;
        else if (selectedCategory) message = `No products currently in stock for ${selectedCategory}.`;
        return <div className="alert alert-info text-center my-4" role="alert">{message} {selectedCategory && <button onClick={onClearCategoryFilter} className="btn btn-link p-0 ms-1">View all categories</button>}</div>;
    }

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap">
                <h1 className="h3 text-primary mb-0">{title}</h1>
                <div className="d-flex gap-2 mt-2 mt-md-0">
                    {selectedCategory && !searchTerm.trim() && <button onClick={onClearCategoryFilter} className="btn btn-outline-secondary btn-sm">View All Categories</button>}
                    <button onClick={onToggleDetails} className="btn btn-outline-secondary btn-sm" aria-pressed={showDetails}>
                        {showDetails ? "Hide Full Details" : "Show Full Details"}
                    </button>
                </div>
            </div>
            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4">
                {products.map(product => (
                    <div className="col" key={product.id}>
                        <ProductCard product={product} onAddToCart={onAddToCart} currentUser={currentUser} onRequestLogin={onRequestLogin} showDetails={showDetails} />
                    </div>
                ))}
            </div>
        </div>
    );
};

interface ProductCardProps { product: Product; onAddToCart: (product: Product) => void; currentUser: UserCredentials | null; onRequestLogin: () => void; showDetails: boolean; }
const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, currentUser, onRequestLogin, showDetails }) => {
    const handleAddToCartClick = () => {
        if (!currentUser) { onRequestLogin(); return; }
        if (product.stock > 0) onAddToCart(product);
    };
    const isOutOfStock = product.stock <= 0;
    return (
        <div className={`card h-100 product-card-bs ${isOutOfStock ? 'border-danger opacity-75' : ''} ${!showDetails ? 'details-hidden-bs' : ''}`}>
            <img src={product.imageUrl} className="card-img-top product-image-bs" alt={product.name} />
            <div className="card-body d-flex flex-column">
                <h5 className="card-title text-primary">{product.name}</h5>
                {showDetails && <span className="badge bg-secondary mb-2 align-self-start">{product.category}</span>}
                {showDetails && <p className={`card-text small ${!showDetails ? 'd-none' : ''}`}>{product.description}</p>}
                <div className="mt-auto">
                    {showDetails && <p className={`card-text fw-bold fs-5 text-success mb-2 ${!showDetails ? 'd-none' : ''}`}>${product.price.toFixed(2)}</p>}
                    {isOutOfStock && <span className="badge bg-danger position-absolute top-0 end-0 m-2">Out of Stock</span>}
                    <button onClick={handleAddToCartClick} className={`btn w-100 ${isOutOfStock ? 'btn-secondary' : 'btn-warning'}`} disabled={isOutOfStock && currentUser != null}>
                        {currentUser ? (isOutOfStock ? "Out of Stock" : "Add to Cart") : "Login to Add"}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface CartViewProps { 
    cartItems: CartItem[]; onRemoveFromCart: (productId: string) => void; onUpdateQuantity: (productId: string, quantity: number) => void; 
    onProceedToCheckout: () => void; products: Product[]; subtotal: number; gstAmount: number; shippingFee: number; grandTotal: number;
}
const CartView: React.FC<CartViewProps> = ({ cartItems, onRemoveFromCart, onUpdateQuantity, onProceedToCheckout, products, subtotal, gstAmount, shippingFee, grandTotal }) => {
    if (cartItems.length === 0) return (<div className="text-center py-5"><h1>Your Shopping Cart</h1><p className="lead">Your cart is empty. Start shopping!</p></div>);
    return (
        <div className="py-4">
            <h1 className="mb-4 text-center">Your Shopping Cart</h1>
            <div className="row">
                <div className="col-lg-8">
                    {cartItems.map(item => {
                        const productDetails = products.find(p => p.id === item.id);
                        const itemStock = productDetails?.stock ?? 0;
                        return (
                            <div key={item.id} className="card mb-3 cart-item-bs">
                                <div className="row g-0">
                                    <div className="col-md-3 text-center">
                                        <img src={item.imageUrl} className="img-fluid rounded-start cart-item-image-bs" alt={item.name} />
                                    </div>
                                    <div className="col-md-9">
                                        <div className="card-body">
                                            <div className="d-flex justify-content-between">
                                                <h5 className="card-title">{item.name}</h5>
                                                <button onClick={() => onRemoveFromCart(item.id)} className="btn btn-sm btn-outline-danger" aria-label={`Remove ${item.name} from cart`}>&times;</button>
                                            </div>
                                            <p className="card-text"><small className="text-muted">Category: {item.category}</small></p>
                                            <p className="card-text fw-bold">Price: ${item.price.toFixed(2)}</p>
                                            {item.quantity > itemStock && itemStock > 0 && <p className="text-danger small">Note: Only {itemStock} available. Cart adjusted.</p>}
                                            {itemStock === 0 && <p className="text-danger small">Note: Item out of stock. Please remove.</p>}
                                            <div className="d-flex align-items-center">
                                                <label htmlFor={`quantity-${item.id}`} className="form-label me-2 mb-0 small">Qty:</label>
                                                <div className="input-group input-group-sm" style={{maxWidth: "120px"}}>
                                                    <button className="btn btn-outline-secondary" type="button" onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}>-</button>
                                                    <input type="text" id={`quantity-${item.id}`} className="form-control text-center" value={item.quantity} readOnly />
                                                    <button className="btn btn-outline-secondary" type="button" onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= itemStock}>+</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="col-lg-4">
                    <div className="card">
                        <div className="card-body">
                            <h5 className="card-title text-center mb-3">Order Summary</h5>
                            <ul className="list-group list-group-flush">
                                <li className="list-group-item d-flex justify-content-between"><span>Subtotal:</span> <span>${subtotal.toFixed(2)}</span></li>
                                <li className="list-group-item d-flex justify-content-between"><span>GST ({(GST_RATE * 100).toFixed(0)}%):</span> <span>${gstAmount.toFixed(2)}</span></li>
                                <li className="list-group-item d-flex justify-content-between"><span>Shipping Fee:</span> <span>${shippingFee.toFixed(2)}</span></li>
                                <li className="list-group-item d-flex justify-content-between fw-bold fs-5"><span>Grand Total:</span> <span>${grandTotal.toFixed(2)}</span></li>
                            </ul>
                            <button className="btn btn-primary w-100 mt-3" onClick={onProceedToCheckout}>Proceed to Checkout</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface CheckoutViewProps { onBackToCart: () => void; onConfirmOrder: (details: CheckoutDetails) => void; currentUser: UserCredentials; }
const CheckoutView: React.FC<CheckoutViewProps> = ({ onBackToCart, onConfirmOrder, currentUser }) => {
    const [name, setName] = useState(currentUser.fullName); const [phone, setPhone] = useState(''); const [addressLine1, setAddressLine1] = useState('');
    const [city, setCity] = useState(''); const [pincode, setPincode] = useState(''); const [paymentMethod, setPaymentMethod] = useState('creditCard');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [validated, setValidated] = useState(false);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        const form = event.currentTarget;
        event.preventDefault();
        event.stopPropagation();
    
        const newErrors: Record<string, string> = {};
        if (!name.trim()) newErrors.name = "Full name required."; 
        if (!phone.trim()) newErrors.phone = "Phone number required."; else if (!/^\+?[0-9\s-]{7,15}$/.test(phone)) newErrors.phone = "Invalid phone format.";
        if (!addressLine1.trim()) newErrors.addressLine1 = "Address required."; 
        if (!city.trim()) newErrors.city = "City required.";
        if (!pincode.trim()) newErrors.pincode = "Pincode required."; else if (!/^[A-Za-z0-9\s-]{3,10}$/.test(pincode)) newErrors.pincode = "Invalid pincode format.";
        if (!paymentMethod) newErrors.paymentMethod = "Payment method required.";
        setErrors(newErrors);
    
        if (form.checkValidity() === false || Object.keys(newErrors).length > 0) {
          setValidated(true);
        } else {
          onConfirmOrder({ name, phone, addressLine1, city, pincode, paymentMethod });
        }
    };

    return (
        <div className="py-4">
            <h1 className="mb-4 text-center">Checkout</h1>
            <p className="text-center lead mb-4">Hello, {currentUser.isAdmin ? currentUser.fullName : currentUser.fullName.split(' ')[0]}! Provide details to complete order.</p>
            <form noValidate className={`needs-validation ${validated ? 'was-validated' : ''} checkout-form-bs`} onSubmit={handleSubmit}>
                <div className="row">
                    <div className="col-md-6 mb-4">
                        <h4 className="mb-3">Shipping Information</h4>
                        <div className="mb-3">
                            <label htmlFor="checkout-name-bs" className="form-label">Full Name</label>
                            <input type="text" className={`form-control ${errors.name ? 'is-invalid' : ''}`} id="checkout-name-bs" value={name} onChange={(e) => setName(e.target.value)} required />
                            {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                        </div>
                        <div className="mb-3">
                            <label htmlFor="checkout-phone-bs" className="form-label">Phone Number</label>
                            <input type="tel" className={`form-control ${errors.phone ? 'is-invalid' : ''}`} id="checkout-phone-bs" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+1234567890" />
                            {errors.phone && <div className="invalid-feedback">{errors.phone}</div>}
                        </div>
                        <div className="mb-3">
                            <label htmlFor="checkout-address-bs" className="form-label">Address Line 1</label>
                            <input type="text" className={`form-control ${errors.addressLine1 ? 'is-invalid' : ''}`} id="checkout-address-bs" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} required placeholder="123 Gem Street"/>
                            {errors.addressLine1 && <div className="invalid-feedback">{errors.addressLine1}</div>}
                        </div>
                        <div className="row">
                            <div className="col-md-7 mb-3">
                                <label htmlFor="checkout-city-bs" className="form-label">City</label>
                                <input type="text" className={`form-control ${errors.city ? 'is-invalid' : ''}`} id="checkout-city-bs" value={city} onChange={(e) => setCity(e.target.value)} required placeholder="Tech City" />
                                 {errors.city && <div className="invalid-feedback">{errors.city}</div>}
                            </div>
                            <div className="col-md-5 mb-3">
                                <label htmlFor="checkout-pincode-bs" className="form-label">Pincode / ZIP</label>
                                <input type="text" className={`form-control ${errors.pincode ? 'is-invalid' : ''}`} id="checkout-pincode-bs" value={pincode} onChange={(e) => setPincode(e.target.value)} required placeholder="90210" />
                                {errors.pincode && <div className="invalid-feedback">{errors.pincode}</div>}
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6 mb-4">
                        <h4 className="mb-3">Payment Method</h4>
                        <div className="my-3">
                            <div className="form-check">
                                <input id="creditCard" name="paymentMethod" type="radio" className="form-check-input" value="creditCard" checked={paymentMethod === 'creditCard'} onChange={(e) => setPaymentMethod(e.target.value)} required />
                                <label className="form-check-label" htmlFor="creditCard">Credit Card</label>
                            </div>
                            <div className="form-check">
                                <input id="paypal" name="paymentMethod" type="radio" className="form-check-input" value="paypal" checked={paymentMethod === 'paypal'} onChange={(e) => setPaymentMethod(e.target.value)} required />
                                <label className="form-check-label" htmlFor="paypal">PayPal</label>
                            </div>
                            {errors.paymentMethod && <div className="text-danger small mt-1">{errors.paymentMethod}</div>}
                        </div>
                        {paymentMethod === 'creditCard' && (
                            <div className="row gy-3">
                                <div className="col-md-6"><label htmlFor="cc-name" className="form-label">Name on card</label><input type="text" className="form-control" id="cc-name" placeholder="Full name as displayed on card" /><small className="text-muted">Mock field</small></div>
                                <div className="col-md-6"><label htmlFor="cc-number" className="form-label">Credit card number</label><input type="text" className="form-control" id="cc-number" placeholder="XXXX-XXXX-XXXX-XXXX" /><small className="text-muted">Mock field</small></div>
                                <div className="col-md-3"><label htmlFor="cc-expiration" className="form-label">Expiration</label><input type="text" className="form-control" id="cc-expiration" placeholder="MM/YY"/><small className="text-muted">Mock field</small></div>
                                <div className="col-md-3"><label htmlFor="cc-cvv" className="form-label">CVV</label><input type="text" className="form-control" id="cc-cvv" placeholder="123"/><small className="text-muted">Mock field</small></div>
                            </div>
                        )}
                    </div>
                </div>
                <hr className="my-4" />
                <div className="d-flex justify-content-between">
                    <button className="btn btn-outline-secondary btn-lg" type="button" onClick={onBackToCart}>Back to Cart</button>
                    <button className="btn btn-primary btn-lg" type="submit">Confirm Order</button>
                </div>
            </form>
        </div>
    );
};

interface AdminViewProps { products: Product[]; onNavigateToHome: () => void; onNavigateToAddProduct: () => void; onDeleteProduct: (productId: string) => void; onUpdateStock: (productId: string, newStock: number) => void;}
const AdminViewProductItem: React.FC<{ product: Product; onDeleteProduct: (productId: string) => void; onUpdateStock: (productId: string, newStock: number) => void;}> = ({ product, onDeleteProduct, onUpdateStock }) => {
    const [editableStock, setEditableStock] = useState<string>(product.stock.toString());
    const handleStockChange = (e: React.ChangeEvent<HTMLInputElement>) => setEditableStock(e.target.value);
    const handleUpdateClick = () => {
        const newStock = parseInt(editableStock, 10);
        if (!isNaN(newStock) && newStock >= 0) {
            onUpdateStock(product.id, newStock);
        } else {
            alert("Please enter a valid non-negative number for stock.");
            setEditableStock(product.stock.toString()); 
        }
    };
    useEffect(() => { setEditableStock(product.stock.toString()); }, [product.stock]);

    return (
        <li className="list-group-item d-flex flex-wrap justify-content-between align-items-center">
            <div className="d-flex align-items-center me-3 flex-grow-1" style={{minWidth: '200px'}}>
                <img src={product.imageUrl} alt={product.name} className="me-3 rounded" style={{width: '50px', height: '50px', objectFit: 'cover'}}/>
                <div>
                    <h6 className="mb-0">{product.name} <span className="badge bg-secondary ms-1">{product.category}</span></h6>
                    <small className="text-muted d-block">Price: ${product.price.toFixed(2)}</small>
                    <small className="text-muted d-block">ID: {product.id}</small>
                    <small className={`d-block fw-bold ${product.stock <=0 ? 'text-danger' : 'text-success'}`}>Stock: {product.stock}</small>
                </div>
            </div>
            <div className="d-flex align-items-center mt-2 mt-md-0 admin-product-actions-bs">
                <input type="number" value={editableStock} onChange={handleStockChange} className="form-control form-control-sm me-2" style={{width: "70px"}} min="0" aria-label={`Stock for ${product.name}`}/>
                <button onClick={handleUpdateClick} className="btn btn-outline-primary btn-sm me-2">Update</button>
                <button onClick={() => onDeleteProduct(product.id)} className="btn btn-outline-danger btn-sm">Delete</button>
            </div>
        </li>
    );
};

const AdminView: React.FC<AdminViewProps> = ({ products, onNavigateToHome, onNavigateToAddProduct, onDeleteProduct, onUpdateStock }) => {
    const totalProducts = products.length;
    const productsInStock = products.filter(p => p.stock > 0).length;
    const productsOutOfStock = totalProducts - productsInStock;

    return (
        <div className="py-4">
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
                <h1 className="h2 text-primary mb-0">Admin Panel</h1>
                <div>
                    <button onClick={onNavigateToAddProduct} className="btn btn-success me-2">Add New Product</button>
                    <button onClick={onNavigateToHome} className="btn btn-outline-secondary">Back to Shop</button>
                </div>
            </div>
            
            <section className="mb-4 p-3 bg-light border rounded">
                <h2 className="h5 text-center mb-3">Store Overview</h2>
                <div className="row text-center">
                    <div className="col-md-4 mb-2 mb-md-0"><div className="card"><div className="card-body"><h6 className="card-subtitle mb-2 text-muted">Total Products</h6><p className="card-text fs-4 fw-bold">{totalProducts}</p></div></div></div>
                    <div className="col-md-4 mb-2 mb-md-0"><div className="card"><div className="card-body"><h6 className="card-subtitle mb-2 text-muted">In Stock</h6><p className="card-text fs-4 fw-bold text-success">{productsInStock}</p></div></div></div>
                    <div className="col-md-4"><div className="card"><div className="card-body"><h6 className="card-subtitle mb-2 text-muted">Out of Stock</h6><p className="card-text fs-4 fw-bold text-danger">{productsOutOfStock}</p></div></div></div>
                </div>
            </section>

            <section className="p-3 border rounded">
                <h2 className="h5 mb-3">Product Management ({products.length})</h2>
                {products.length === 0 ? (<div className="alert alert-info">No products found. Added products appear here and homepage (if in stock).</div>) : (
                    <ul className="list-group">
                        {products.map(p => <AdminViewProductItem key={p.id} product={p} onDeleteProduct={onDeleteProduct} onUpdateStock={onUpdateStock} />)}
                    </ul>
                )}
            </section>
        </div>
    );
};


interface AddProductViewProps { onAddProduct: (productData: Omit<Product, 'id' | 'imageUrl' | 'stock'> & { imageUrl?: string, stock: number }) => Promise<string | null>; onNavigateBackToAdmin: () => void; }
const AddProductView: React.FC<AddProductViewProps> = ({ onAddProduct, onNavigateBackToAdmin }) => {
    const [productName, setProductName] = useState(''); const [description, setDescription] = useState(''); const [price, setPrice] = useState('');
    const [category, setCategory] = useState(''); const [imageUrl, setImageUrl] = useState(''); const [stock, setStock] = useState('10');
    const [formErrors, setFormErrors] = useState<Record<string, string>>({}); const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
    const [validated, setValidated] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        const form = event.currentTarget;
        event.preventDefault();
        event.stopPropagation();
        setSubmissionMessage(null);
    
        const newErrors: Record<string, string> = {};
        if (!productName.trim()) newErrors.productName = "Product name required."; 
        if (!description.trim()) newErrors.description = "Description required.";
        if (!price.trim()) newErrors.price = "Price required."; else if (isNaN(parseFloat(price)) || parseFloat(price) <= 0) newErrors.price = "Price must be positive.";
        if (!category.trim()) newErrors.category = "Category required.";
        if (!stock.trim()) newErrors.stock = "Stock required."; else if (isNaN(parseInt(stock)) || parseInt(stock) < 0) newErrors.stock = "Stock must be non-negative number.";
        setFormErrors(newErrors);
    
        if (form.checkValidity() === false || Object.keys(newErrors).length > 0) {
          setValidated(true);
        } else {
            setValidated(false);
            const productData = { name: productName, description, price: parseFloat(price), category, imageUrl: imageUrl.trim() || undefined, stock: parseInt(stock, 10) };
            const resultMessage = await onAddProduct(productData);
            setSubmissionMessage(resultMessage);
            if (resultMessage && resultMessage.includes("successfully")) { setProductName(''); setDescription(''); setPrice(''); setCategory(''); setImageUrl(''); setStock('10'); setFormErrors({}); form.reset(); setValidated(false); }
        }
    };
    return (
        <div className="py-4 add-product-view-bs">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1 className="h2 text-primary mb-0">Add New Product</h1>
                <button onClick={onNavigateBackToAdmin} className="btn btn-outline-secondary">Back to Admin Panel</button>
            </div>
            {submissionMessage && (<div className={`alert ${submissionMessage.includes("successfully") ? 'alert-success' : 'alert-danger'} text-center`}>{submissionMessage}</div>)}
            <form noValidate className={`needs-validation ${validated ? 'was-validated' : ''} border p-4 rounded bg-light`} onSubmit={handleSubmit}>
                <div className="mb-3">
                    <label htmlFor="admin-productName-bs" className="form-label">Product Name</label>
                    <input type="text" className={`form-control ${formErrors.productName ? 'is-invalid' : ''}`} id="admin-productName-bs" value={productName} onChange={(e) => setProductName(e.target.value)} required />
                    <div className="invalid-feedback">{formErrors.productName}</div>
                </div>
                <div className="mb-3">
                    <label htmlFor="admin-description-bs" className="form-label">Description</label>
                    <textarea className={`form-control ${formErrors.description ? 'is-invalid' : ''}`} id="admin-description-bs" value={description} onChange={(e) => setDescription(e.target.value)} required rows={3}></textarea>
                    <div className="invalid-feedback">{formErrors.description}</div>
                </div>
                 <div className="row">
                    <div className="col-md-6 mb-3">
                        <label htmlFor="admin-price-bs" className="form-label">Price</label>
                        <input type="number" className={`form-control ${formErrors.price ? 'is-invalid' : ''}`} id="admin-price-bs" value={price} onChange={(e) => setPrice(e.target.value)} required step="0.01" min="0.01" />
                        <div className="invalid-feedback">{formErrors.price}</div>
                    </div>
                    <div className="col-md-6 mb-3">
                        <label htmlFor="admin-category-bs" className="form-label">Category</label>
                        <input type="text" className={`form-control ${formErrors.category ? 'is-invalid' : ''}`} id="admin-category-bs" value={category} onChange={(e) => setCategory(e.target.value)} required />
                        <div className="invalid-feedback">{formErrors.category}</div>
                    </div>
                </div>
                <div className="row">
                    <div className="col-md-6 mb-3">
                        <label htmlFor="admin-stock-bs" className="form-label">Initial Stock</label>
                        <input type="number" className={`form-control ${formErrors.stock ? 'is-invalid' : ''}`} id="admin-stock-bs" value={stock} onChange={(e) => setStock(e.target.value)} required min="0" />
                        <div className="invalid-feedback">{formErrors.stock}</div>
                    </div>
                     <div className="col-md-6 mb-3">
                        <label htmlFor="admin-imageUrl-bs" className="form-label">Image URL (Optional)</label>
                        <input type="text" className="form-control" id="admin-imageUrl-bs" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Leave blank for default" />
                    </div>
                </div>
                <button type="submit" className="btn btn-primary w-100 mt-2">Add Product</button>
            </form>
        </div>
    );
};

const ChatbotButton: React.FC<{ onToggleChat: () => void }> = ({ onToggleChat }) => (<button className="btn btn-primary rounded-circle p-0 chatbot-fab-bs" onClick={onToggleChat} aria-label="Open chat assistant">💬</button>);
interface ChatWindowProps { messages: ChatMessage[]; inputValue: string; onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onSendMessage: (e: FormEvent) => Promise<void>; onClose: () => void; isLoading: boolean; chatMessagesEndRef: React.RefObject<HTMLDivElement>; }
const ChatWindow: React.FC<ChatWindowProps> = ({ messages, inputValue, onInputChange, onSendMessage, onClose, isLoading, chatMessagesEndRef }) => (
    <div className="offcanvas offcanvas-end show chatbot-window-bs" tabIndex={-1} id="chatOffcanvas" aria-labelledby="chatOffcanvasLabel">
        <div className="offcanvas-header bg-primary text-white">
            <h5 className="offcanvas-title" id="chatOffcanvasLabel">GeminiStore Assistant</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close"></button>
        </div>
        <div className="offcanvas-body d-flex flex-column p-0">
            <div className="flex-grow-1 p-3 overflow-auto chatbot-messages-bs">
                {messages.map(msg => (<div key={msg.id} className={`p-2 mb-2 rounded chat-message-bs ${msg.sender === 'user' ? 'bg-light ms-auto text-dark' : (msg.sender === 'assistant' ? 'bg-primary text-white me-auto' : 'bg-danger-subtle text-danger-emphasis me-auto')}`}>{msg.text}</div>))}
                {isLoading && <div className="p-2 mb-2 rounded chat-message-bs bg-primary text-white me-auto">Thinking...</div>}
                <div ref={chatMessagesEndRef} />
            </div>
            <form className="p-3 border-top" onSubmit={onSendMessage}>
                <div className="input-group">
                    <input type="text" className="form-control" value={inputValue} onChange={onInputChange} placeholder="Ask me anything..." aria-label="Chat message input" disabled={isLoading} />
                    <button className="btn btn-primary" type="submit" disabled={isLoading || !inputValue.trim()}>Send</button>
                </div>
            </form>
        </div>
    </div>
);

interface FooterProps { currentUser: UserCredentials | null; onNavigateToAdmin?: () => void; }
const Footer: React.FC<FooterProps> = ({ currentUser, onNavigateToAdmin }) => (
    <footer className="bg-dark text-light text-center py-4 mt-auto">
        <div className="container">
            <p className="mb-1">© {new Date().getFullYear()} GeminiStore. Powered by AI.</p>
            {onNavigateToAdmin && (
                <div><button onClick={onNavigateToAdmin} className="btn btn-link text-light p-0">Admin Panel</button></div>
            )}
        </div>
    </footer>
);

const rootElement = document.getElementById('root');
if (rootElement) { ReactDOM.createRoot(rootElement).render(<React.StrictMode><App /></React.StrictMode>); } 
else { console.error("Root element not found."); }
