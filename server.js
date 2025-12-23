const express = require('express');
const fs = require('fs');
const cors = require('cors');
const app = express();
app.use(express.json());
app.use(cors());

const USERS_FILE = './data/users.json';
const PRODUCTS_FILE = './data/productList.json';

app.post('/login', (req, res) => {
  const { userID, password } = req.body;
  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  const found = users.find(u => u.userID === userID && u.password === password);

  if (!found) return res.status(401).json({ message: 'Invalid credentials' });
  return res.json({ userID: found.userID, role: found.role });
});

app.get('/product-list', (req, res) => {
  const data = fs.readFileSync(PRODUCTS_FILE, 'utf8');
  let list = JSON.parse(data);

  const { productStatus, productCategory, search } = req.query;

  if (productStatus && productStatus !== "All") {
    list = list.filter(p => p.productStatus === productStatus);
  }

  if (productCategory && productCategory !== "All") {
    list = list.filter(p => p.productCategory === productCategory);
  }

  if (search && search.trim() !== "") {
    list = list.filter(p =>
      p.productName.toLowerCase().includes(search.toLowerCase())
    );
  }

  return res.json(list);
});

app.get('/product-stats', (req, res) => {
  const data = fs.readFileSync(PRODUCTS_FILE, 'utf8');
  const list = JSON.parse(data);

  const statusMap = {
    "1": "Approved",
    "2": "Pending",
    "3": "Rejected"
  };

  const statusCounts = {
    approved: list.filter(p => p.productStatus === "1").length,
    pending: list.filter(p => p.productStatus === "2").length,
    rejected: list.filter(p => p.productStatus === "3").length
  };

  const categoryCounts = {};

  list.forEach(item => {
    const statusName = statusMap[item.productStatus] || "Unknown";
    const category = item.productCategory;

    if (!categoryCounts[statusName]) categoryCounts[statusName] = {};
    if (!categoryCounts[statusName][category]) categoryCounts[statusName][category] = 0;

    categoryCounts[statusName][category]++;
  });

  return res.json({
    statusCounts,
    categoryCounts
  });
});


app.post('/product-approve', (req, res) => {
  const { productID, checkerID, checkerComment } = req.body;

  if (!productID || !Array.isArray(productID)) {
    return res.status(400).json({ message: "Invalid productID" });
  }

  const data = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));

  let updatedCount = 0;

  const updated = data.map(p => {
    if (productID.includes(p.productID) && p.productStatus === "2") {
      updatedCount++;
      return {
        ...p,
        productStatus: "1",
        checkerID: checkerID || null,
        checkerComment: checkerComment || "Approved"
      };
    }
    return p;
  });

  if (updatedCount === 0) {
    return res.status(400).json({
      message: "Only submitted (Pending) products can be approved"
    });
  }

  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(updated, null, 2));

  return res.json({
    message: `${updatedCount} product(s) approved successfully`
  });
});

app.post('/product-reject', (req, res) => {
  const { productID, checkerID, checkerComment } = req.body;

  if (!productID || !Array.isArray(productID)) {
    return res.status(400).json({ message: "Invalid productID" });
  }

  const data = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));

  let updatedCount = 0;

  const updated = data.map(p => {
    if (productID.includes(p.productID) && p.productStatus === "2") {
      updatedCount++;
      return {
        ...p,
        productStatus: "3",
        checkerID: checkerID || null,
        checkerComment
      };
    }
    return p;
  });

  if (updatedCount === 0) {
    return res.status(400).json({
      message: "Only submitted (Pending) products can be rejected"
    });
  }

  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(updated, null, 2));

  return res.json({
    message: `${updatedCount} product(s) rejected successfully`
  });
});

app.post('/product-submit', (req, res) => {
  const { productID, userID, makerComment } = req.body;

  if (!Array.isArray(productID) || !userID) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const data = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));

  const updated = data.map(p => {
    if (
      productID.includes(p.productID) &&
      p.makerRoleID === userID &&
      (p.productStatus === "2" || p.productStatus === "3")
    ) {
      return {
        ...p,
        productStatus: "2",
        makerComment: makerComment || "",
        checkerComment: ""
      };
    }
    return p;
  });

  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(updated, null, 2));
  return res.json({ message: "Products submitted successfully" });
});

app.put('/product/:id', (req, res) => {
  const { userID, role } = req.body;
  const id = req.params.id;

  const list = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  const product = list.find(p => p.productID === id);

  if (!product) return res.status(404).json({ message: "Not found" });

  if (role?.startsWith("Maker")) {
    if (product.makerRoleID !== userID) {
      return res.status(403).json({ message: "Not authorized" });
    }
  }

  if (product.productStatus === "1") {
    return res.status(403).json({ message: "Approved products cannot be edited" });
  }

  if (role === "Checker") {
    product.productPrice = req.body.productPrice;
  } else {
    product.productName = req.body.productName;
    product.productCategory = req.body.productCategory;
    product.productPrice = req.body.productPrice;
  }

  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(list, null, 2));
  res.json({ success: true });
});


app.post("/bulk-action", (req, res) => {
  const { productIDs, action, checkerID, comment } = req.body;

  const products = JSON.parse(
    fs.readFileSync("./data/productList.json", "utf-8")
  );

  const updatedProducts = products.map(p => {
    if (productIDs.includes(p.productID) && p.productStatus === "2") {
      return {
        ...p,
        productStatus: action === "approve" ? "1" : "3",
        checkerComment: comment || "",
        checkerID,
        checkedAt: new Date().toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        })

      };
    }
    return p;
  });

  fs.writeFileSync(
    "./data/productList.json",
    JSON.stringify(updatedProducts, null, 2)
  );

  res.json({ success: true });
});

app.get("/health", (req, res) => {
  res.send("OK");
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
