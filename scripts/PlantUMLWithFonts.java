import java.awt.Font;
import java.awt.GraphicsEnvironment;
import java.io.File;
import java.util.Locale;
import net.sourceforge.plantuml.Run;

/** Load the exact local CJK faces before PlantUML measures or draws any text. */
class PlantUMLWithFonts {
    public static void main(String[] args) throws Exception {
        GraphicsEnvironment graphics = GraphicsEnvironment.getLocalGraphicsEnvironment();
        for (String variable : new String[]{"AIC_FONT_REGULAR", "AIC_FONT_BOLD"}) {
            String path = System.getenv(variable);
            if (path == null) throw new IllegalArgumentException("Missing " + variable);
            for (Font font : Font.createFonts(new File(path))) {
                graphics.registerFont(font);
                System.err.println("Loaded font: " + font.getFamily(Locale.ROOT));
            }
        }
        Run.main(args);
    }
}
