document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("bgcForm");

    form.addEventListener("submit", function(event) {
        event.preventDefault();
        handleBGCFormSubmit();
    });
});

async function handleBGCFormSubmit() {
    const usernameOrId = document.getElementById("username").value.trim();
    const platform     = document.getElementById("platform").value;
    const reason       = document.getElementById("reason").value.trim();

    if (!usernameOrId || !reason) return; 

    try {
        if (platform.toLowerCase() === "roblox") {
            const userInfo = await getRobloxUserByUsername(usernameOrId);
            if (userInfo) await generatePDF(userInfo, reason, platform);
        }
        
    } catch {
        // silently fail on errors
    }
}

// Fetch Roblox user info by username or ID using AllOrigins proxy
async function getRobloxUserByUsername(input) {
    let userId = input;
    const proxyUrl = "https://api.allorigins.win/raw?url=";

   
    if (isNaN(input)) {
        const searchUrl = encodeURIComponent(`https://users.roblox.com/v1/users/search?keyword=${input}&limit=1`);
        const searchRes = await fetch(proxyUrl + searchUrl);
        const searchData = await searchRes.json();
        if (!searchData.data || searchData.data.length === 0) return null;
        userId = searchData.data[0].id;
    }

    const userRes = await fetch(proxyUrl + encodeURIComponent(`https://users.roblox.com/v1/users/${userId}`));
    const userData = await userRes.json();

    const avatarRes = await fetch(proxyUrl + encodeURIComponent(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=48x48&format=Png`));
    const avatarData = await avatarRes.json();

    return {
        id: userData.id,
        username: userData.name,
        displayName: userData.displayName,
        created: userData.created,
        banned: userData.isBanned,
        avatar: avatarData.data[0].imageUrl
    };
}

// Convert avatar URL to base64 for PDF
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

    doc.setFontSize(16);
    doc.text(`${platform} Background Check Report`, 10, 20);
    doc.setFontSize(12);
    doc.text(`Reason: ${reason}`, 10, 30);
    doc.text(`ID: ${userInfo.id}`, 10, 40);
    doc.text(`Username: ${userInfo.username}`, 10, 50);
    doc.text(`Display Name: ${userInfo.displayName}`, 10, 60);
    doc.text(`Created: ${new Date(userInfo.created).toLocaleString()}`, 10, 70);
    doc.text(`Banned: ${userInfo.banned}`, 10, 80);

    const avatarDataURL = await loadImageAsDataURL(userInfo.avatar);
    if (avatarDataURL) doc.addImage(avatarDataURL, "PNG", 150, 20, 40, 40);

    doc.save(`${userInfo.username}_BGC_Report.pdf`);
}
