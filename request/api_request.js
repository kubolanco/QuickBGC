document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("bgcForm");

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        handleBGCFormSubmit();
    });
});

const WORKER_URL = "https://backendquickbgc.kubo-lanco.workers.dev/?url=";

async function handleBGCFormSubmit() {
    const usernameOrId = document.getElementById("username").value.trim();
    const platform = document.getElementById("platform").value;
    const reason = document.getElementById("reason").value.trim();

    if (!usernameOrId || !reason) return;

    try {
        if (platform.toLowerCase() === "roblox") {
            const userInfo = await getRobloxUserData(usernameOrId);
            if (userInfo) await generatePDF(userInfo, reason, platform);
        }
    } catch (err) {
        console.error("[ERROR] handleBGCFormSubmit:", err);
    }
}

async function fetchFromWorker(url) {
    const response = await fetch(`${WORKER_URL}${encodeURIComponent(url)}`);
    if (!response.ok) throw new Error(`Failed fetch: ${url}`);
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return await response.json();
    return await response.text();
}

async function getRobloxUserData(input) {
    let userId = input;

    // Resolve username to ID
    if (isNaN(input)) {
        const searchData = await fetchFromWorker(
            `https://users.roblox.com/v1/users/search?keyword=${input}&limit=10`
        );
        if (!searchData.data || searchData.data.length === 0) return null;
        userId = searchData.data[0].id;
    }

    // Basic user info
    const userData = await fetchFromWorker(`https://users.roblox.com/v1/users/${userId}`);

    // Avatar
    const avatarData = await fetchFromWorker(
        `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`
    );

    // Friends
    let friendsCount = 0;
    try {
        const friendsData = await fetchFromWorker(
            `https://friends.roblox.com/v1/users/${userId}/friends/count`
        );
        friendsCount = friendsData.count || 0;
    } catch {}

    // Groups
    let groupsList = [];
    try {
        const groups = await fetchFromWorker(
            `https://groups.roblox.com/v2/users/${userId}/groups/roles`
        );
        groupsList = groups.data
            ? groups.data.map(g => `${g.group.name} (${g.role.name})`)
            : [];
    } catch {}

    // Badges
    let badgesCount = 0;
    try {
        const badges = await fetchFromWorker(
            `https://badges.roblox.com/v1/users/${userId}/badges?limit=100`
        );
        badgesCount = badges.data ? badges.data.length : 0;
    } catch {}

    // Favorite games count
    let favoritesCount = 0;
    try {
        const favorites = await fetchFromWorker(
            `https://games.roblox.com/v2/users/${userId}/favorite/games`
        );
        favoritesCount = favorites.data ? favorites.data.length : 0;
    } catch {}

    // Status
    let userStatus = "";
    try {
        const status = await fetchFromWorker(
            `https://users.roblox.com/v1/users/${userId}/status`
        );
        userStatus = status.status || "";
    } catch {}

    return {
        id: userData.id,
        username: userData.name,
        displayName: userData.displayName,
        description: userData.description || "None",
        created: userData.created,
        banned: userData.isBanned,
        avatar: avatarData?.data?.[0]?.imageUrl || null,
        friendsCount,
        badgesCount,
        favoritesCount,
        userStatus,
        groupsList
    };
}

async function loadImageAsDataURL(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return await new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

async function generatePDF(userInfo, reason, platform) {
    if (!userInfo) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Warning header
    doc.setTextColor(255, 0, 0);
    doc.setFontSize(12);
    doc.text("⚠ WARNING: This tool can be inaccurate.", 10, 15);

    // Title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.text(`${platform} Background Check Report`, 105, 30, { align: "center" });

    // Divider
    doc.setLineWidth(0.5);
    doc.line(10, 35, 200, 35);

    doc.setFontSize(12);
    let y = 45;
    const lineHeight = 8;

    const fields = [
        ["Reason", reason],
        ["ID", userInfo.id],
        ["Username", userInfo.username],
        ["Display Name", userInfo.displayName],
        ["Status", userInfo.userStatus || "None"],
        ["Description", userInfo.description],
        ["Created", new Date(userInfo.created).toLocaleString()],
        ["Banned", userInfo.banned],
        ["Friends", userInfo.friendsCount],
        ["Badges", userInfo.badgesCount],
        ["Favorite Games", userInfo.favoritesCount],
        ["Groups", userInfo.groupsList.length ? userInfo.groupsList.join(", ") : "None"]
    ];

    fields.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${label}:`, 15, y);
        doc.setFont("helvetica", "normal");

        const splitValue = doc.splitTextToSize(String(value), 170);
        doc.text(splitValue, 45, y);
        y += splitValue.length * (lineHeight - 2);
        y += 2;
        if (y > 260) { // new page if too long
            doc.addPage();
            y = 20;
        }
    });

    // Avatar (top-right)
    const avatarDataURL = await loadImageAsDataURL(userInfo.avatar);
    if (avatarDataURL) {
        doc.addImage(avatarDataURL, "PNG", 160, 40, 35, 35);
    }

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("Generated by QuickBGC • Roblox Public API Data", 10, 285);

    doc.save(`${userInfo.username}_BGC_Report.pdf`);
}
