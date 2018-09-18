package webrtc.signaling.socket;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import webrtc.signaling.model.SignalMessage;

import java.util.HashMap;
import java.util.Map;


public class SignalingSocketHandler extends TextWebSocketHandler {

    private static final Logger LOG = LoggerFactory.getLogger(SignalingSocketHandler.class);

    private static final String LOGIN_TYPE = "login";
    private static final String RTC_TYPE = "rtc";
    private static final String GENERATE_URL_TYPE = "generateUrl";
    private static final String DISCONNECT_TYPE = "disconnect";


    // Jackson JSON converter
    private ObjectMapper objectMapper = new ObjectMapper();

    // Here is our Directory (MVP way)
    // This map saves sockets by usernames
    private Map<String, WebSocketSession> clients = new HashMap<String, WebSocketSession>();
    // That map saves username by socket ID
    private Map<String, String> clientIds = new HashMap<String, String>();

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        LOG.debug("handleTextMessage : {}", message.getPayload());

        SignalMessage signalMessage = objectMapper.readValue(message.getPayload(), SignalMessage.class);

        if (LOGIN_TYPE.equalsIgnoreCase(signalMessage.getType()) && !signalMessage.getData().equals("")) {
            // It's a login message so we assume data to be a String representing the username
            String username = (String) signalMessage.getData();

            WebSocketSession client = clients.get(username);

            // quick check to verify that the username is not already taken and active
            if (client == null || !client.isOpen()) {
                LOG.debug("Login {} : OK", username);
                // saves socket and username
                clients.put(username, session);
                clientIds.put(session.getId(), username);
            } else {
                LOG.debug("Login {} : KO", username);
                SignalMessage out = new SignalMessage();
                out.setType("exception");
                out.setDest(clientIds.get(session.getId()));
                out.setData("This name is already in use, please choose a different one or session is closed.");

                // Convert our object back to JSON
                String stringifiedJSONmsg = objectMapper.writeValueAsString(out);

                LOG.debug("send message {}", stringifiedJSONmsg);

                session.sendMessage(new TextMessage(stringifiedJSONmsg));
            }

        } else if (RTC_TYPE.equalsIgnoreCase(signalMessage.getType())) {

            // with the dest username, we can find the targeted socket, if any
            String dest = signalMessage.getDest();
            WebSocketSession destSocket = clients.get(dest);
            // if the socket exists and is open, we go on
            if (destSocket != null && destSocket.isOpen()) {
                // We write the message to send to the dest socket (it's our propriatary format)

                SignalMessage out = new SignalMessage();
                // still an RTC type
                out.setType(RTC_TYPE);
                // we use the dest field to specify the actual exp., but it will be the next dest.
                out.setDest(clientIds.get(session.getId()));
                // The data stays as it is
                out.setData(signalMessage.getData());

                // Convert our object back to JSON
                String stringifiedJSONmsg = objectMapper.writeValueAsString(out);

                LOG.debug("send message {}", stringifiedJSONmsg);

                destSocket.sendMessage(new TextMessage(stringifiedJSONmsg));
            }
        } else if (DISCONNECT_TYPE.equalsIgnoreCase(signalMessage.getType())) {
            System.out.println("Disconnect method's running...");

            String username = (String) signalMessage.getDest();
            WebSocketSession connSession = clients.get(username);

            SignalMessage sm = new SignalMessage();
            sm.setType("disconnect");
            sm.setDest(signalMessage.getDest());
            sm.setData(signalMessage.getData());

            String stringifiedJSONmsg = objectMapper.writeValueAsString(sm);

            LOG.debug("send message {}", stringifiedJSONmsg);

            session.sendMessage(new TextMessage(stringifiedJSONmsg));

            session.close();
        } else if (GENERATE_URL_TYPE.equalsIgnoreCase(signalMessage.getType())) {
            System.out.println("GENERATING URL FOR JOIN method's running...");

            String username = (String) signalMessage.getDest();
            WebSocketSession connSession = clients.get(username);

            SignalMessage sm = new SignalMessage();
            sm.setType("generateUrl");
            sm.setDest(signalMessage.getDest());
            sm.setData("localhost:8081/web/index.html?n=" + clientIds.get(connSession.getId()));

            String stringifiedJSONmsg = objectMapper.writeValueAsString(sm);

            LOG.debug("send message {}", stringifiedJSONmsg);

            session.sendMessage(new TextMessage(stringifiedJSONmsg));
        }
    }
}
